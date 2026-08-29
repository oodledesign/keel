'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ImagePlus, Loader2, Pin, PinOff, Trash2 } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  deleteWorkspaceDocAction,
  getWorkspaceDocDownloadUrlAction,
  listProposalDocsAction,
  registerUploadedWorkspaceDocAction,
  updateProposalDocPinAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { BUILDING_SURVEY_SECTIONS } from '~/lib/building-surveyor/report-sections';

type SurveyPhoto = {
  id: string;
  title: string;
  mimeType: string | null;
  createdAt: string | null;
  pinnedSectionKey: string | null;
};

export function SurveyPhotosPanel({
  accountId,
  accountSlug,
  proposalId,
  clientId,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  clientId?: string | null;
  canEdit: boolean;
}) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<SurveyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
      await updateProposalDocPinAction({
        accountId,
        proposalId,
        docId,
        pinnedSectionKey,
      });
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === docId ? { ...photo, pinnedSectionKey } : photo,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not pin photo',
      );
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

  const pinnedCount = photos.filter((photo) => photo.pinnedSectionKey).length;

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Survey photos
          </h2>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Stored in the workspace files library. Pin a few onto report
            sections; the rest stay here.
            {photos.length > 0
              ? ` ${photos.length} in library${pinnedCount ? `, ${pinnedCount} pinned` : ''}.`
              : ''}
          </p>
        </div>
        {canEdit ? (
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
        <ul className="mt-3 space-y-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] p-2"
            >
              <div className="flex gap-3">
                {previews[photo.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[photo.id]}
                    alt={photo.title}
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
                            Pin to {section.heading}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
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
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
