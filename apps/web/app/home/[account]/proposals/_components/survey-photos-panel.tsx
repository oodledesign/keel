'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Pin,
  PinOff,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  deleteWorkspaceDocAction,
  getWorkspaceDocDownloadUrlAction,
  listProposalDocsAction,
  registerUploadedWorkspaceDocAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import {
  proposeSurveyPhotoCurationAction,
  reorderSurveyPhotosAction,
  updateSurveyPhotoCurationAction,
} from '~/home/[account]/surveys/_lib/server/survey-capture-actions';
import { BUILDING_SURVEY_SECTIONS } from '~/lib/building-surveyor/report-sections';

type SurveyPhoto = {
  id: string;
  title: string;
  mimeType: string | null;
  createdAt: string | null;
  pinnedSectionKey: string | null;
  photoRole?: 'archive' | 'curated';
  caption?: string | null;
  curatedSortOrder?: number | null;
};

export function SurveyPhotosPanel({
  accountId,
  accountSlug,
  proposalId,
  clientId,
  canEdit,
  layout = 'compact',
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  clientId?: string | null;
  canEdit: boolean;
  layout?: 'compact' | 'library';
}) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<SurveyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listProposalDocsAction({
        accountId,
        proposalId,
      });
      const items = (result.items ?? []) as SurveyPhoto[];
      setPhotos(items);

      const urls: Record<string, string> = {};
      await Promise.all(
        items.map(async (item) => {
          if (!item.mimeType?.startsWith('image/')) return;
          const signed = await getWorkspaceDocDownloadUrlAction({
            accountId,
            docId: item.id,
          });
          if (signed.url) urls[item.id] = signed.url;
        }),
      );
      setPreviews(urls);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load photos',
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, proposalId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !canEdit) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${accountId}/${proposalId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(ACCOUNT_DOCS_BUCKET)
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        await registerUploadedWorkspaceDocAction({
          accountId,
          accountSlug,
          title: file.name,
          filePath,
          mimeType: file.type || null,
          fileSizeBytes: file.size,
          proposalId,
          link: clientId ? { type: 'client', id: clientId } : null,
        });
      }
      toast.success(
        files.length === 1
          ? 'Photo uploaded'
          : `${files.length} photos uploaded`,
      );
      await loadPhotos();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not upload photos',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handlePin = async (docId: string, pinnedSectionKey: string | null) => {
    try {
      await updateSurveyPhotoCurationAction({
        accountId,
        accountSlug,
        proposalId,
        docId,
        sectionKey: pinnedSectionKey,
      });
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === docId
            ? {
                ...photo,
                pinnedSectionKey,
                photoRole: pinnedSectionKey ? 'curated' : 'archive',
              }
            : photo,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not pin photo',
      );
    }
  };

  const handleCaption = async (docId: string, caption: string) => {
    try {
      await updateSurveyPhotoCurationAction({
        accountId,
        accountSlug,
        proposalId,
        docId,
        caption,
      });
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === docId ? { ...photo, caption } : photo,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save caption',
      );
    }
  };

  const handleReorder = async (docId: string, direction: -1 | 1) => {
    const photo = photos.find((item) => item.id === docId);
    if (!photo?.pinnedSectionKey) return;
    const sectionKey = photo.pinnedSectionKey;
    const group = photos
      .filter((item) => item.pinnedSectionKey === sectionKey)
      .sort((a, b) => (a.curatedSortOrder ?? 99) - (b.curatedSortOrder ?? 99));
    const index = group.findIndex((item) => item.id === docId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= group.length) return;
    const ordered = [...group];
    const [moved] = ordered.splice(index, 1);
    if (!moved) return;
    ordered.splice(next, 0, moved);

    setPhotos((prev) =>
      prev.map((item) => {
        const order = ordered.findIndex((row) => row.id === item.id);
        return order >= 0 ? { ...item, curatedSortOrder: order } : item;
      }),
    );

    try {
      await reorderSurveyPhotosAction({
        accountId,
        accountSlug,
        proposalId,
        sectionKey,
        orderedDocIds: ordered.map((item) => item.id),
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not reorder photos',
      );
      await loadPhotos();
    }
  };

  const handlePropose = async () => {
    if (!canEdit) return;
    setProposing(true);
    try {
      const result = await proposeSurveyPhotoCurationAction({
        accountId,
        accountSlug,
        proposalId,
      });
      await loadPhotos();
      toast.success(
        result.source === 'ai'
          ? `Proposed ${result.curatedCount} curated photo${
              result.curatedCount === 1 ? '' : 's'
            } with captions.`
          : (result.fallbackReason ??
              'Proposed photos from titles because the AI path was unavailable.'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not propose curated photos',
      );
    } finally {
      setProposing(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteWorkspaceDocAction({
        accountId,
        accountSlug,
        docId,
        proposalId,
      });
      setPhotos((prev) => prev.filter((photo) => photo.id !== docId));
      toast.success('Photo removed');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not remove photo',
      );
    }
  };

  const curatedCount = photos.filter(
    (photo) => photo.photoRole === 'curated' || photo.pinnedSectionKey,
  ).length;
  const listClassName =
    layout === 'library' ? 'mt-3 grid gap-3 sm:grid-cols-2' : 'mt-3 space-y-3';

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Photo library
          </h2>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Full archive stays on the survey. Propose 3–4 photos per section
            that has report text; captions are grounded in those observations.
            {photos.length > 0
              ? ` ${photos.length} in library${curatedCount ? `, ${curatedCount} curated` : ''}.`
              : ''}
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={proposing || photos.length === 0}
              onClick={() => void handlePropose()}
            >
              {proposing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Propose curated
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void handleUpload(event.target.files)}
      />

      {loading ? (
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          Loading photos…
        </p>
      ) : photos.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          No photos yet. Upload site photos here — they reuse the same files
          store as Notes.
        </p>
      ) : (
        <ul className={listClassName}>
          {photos.map((photo) => {
            const isCurated = Boolean(
              photo.photoRole === 'curated' || photo.pinnedSectionKey,
            );
            const sectionSiblings = photos.filter(
              (item) =>
                item.pinnedSectionKey &&
                item.pinnedSectionKey === photo.pinnedSectionKey,
            ).length;

            return (
              <li
                key={photo.id}
                className="rounded-lg border border-[color:var(--workspace-shell-border)] p-2"
              >
                <div className="flex gap-3">
                  {previews[photo.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[photo.id]}
                      alt={photo.caption || photo.title}
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--workspace-shell-sidebar-accent)] text-xs text-[var(--workspace-shell-text-muted)]">
                      File
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {photo.title}
                    </p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                      {isCurated ? 'Curated' : 'Archive'}
                    </p>
                    {canEdit ? (
                      <div className="mt-2 space-y-2">
                        <Label className="sr-only">Pin to section</Label>
                        <select
                          value={photo.pinnedSectionKey ?? ''}
                          onChange={(event) =>
                            void handlePin(photo.id, event.target.value || null)
                          }
                          className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1 text-xs text-[var(--workspace-shell-text)]"
                        >
                          <option value="">Library only</option>
                          {BUILDING_SURVEY_SECTIONS.map((section) => (
                            <option key={section.key} value={section.key}>
                              {isCurated ? 'Move to' : 'Pin to'}{' '}
                              {section.heading}
                            </option>
                          ))}
                        </select>
                        {isCurated ? (
                          <Textarea
                            defaultValue={photo.caption ?? ''}
                            placeholder="Caption grounded in the section notes…"
                            className="min-h-16 text-xs"
                            onBlur={(event) => {
                              const caption = event.target.value.trim();
                              if (caption === (photo.caption ?? '').trim()) {
                                return;
                              }
                              void handleCaption(photo.id, caption);
                            }}
                          />
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {photo.pinnedSectionKey && sectionSiblings > 1 ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => void handleReorder(photo.id, -1)}
                              >
                                <ChevronUp className="mr-1 h-3.5 w-3.5" />
                                Up
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => void handleReorder(photo.id, 1)}
                              >
                                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                                Down
                              </Button>
                            </>
                          ) : null}
                          {photo.pinnedSectionKey ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => void handlePin(photo.id, null)}
                            >
                              <PinOff className="mr-1 h-3.5 w-3.5" />
                              Unpin
                            </Button>
                          ) : (
                            <span className="inline-flex items-center text-xs text-[var(--workspace-shell-text-muted)]">
                              <Pin className="mr-1 h-3.5 w-3.5" />
                              Not pinned
                            </span>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                            onClick={() => void handleDelete(photo.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : photo.pinnedSectionKey ? (
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        Pinned to{' '}
                        {BUILDING_SURVEY_SECTIONS.find(
                          (section) => section.key === photo.pinnedSectionKey,
                        )?.heading ?? photo.pinnedSectionKey}
                        {photo.caption ? ` — ${photo.caption}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
