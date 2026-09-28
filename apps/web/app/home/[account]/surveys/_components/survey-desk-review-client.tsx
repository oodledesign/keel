'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  Loader2,
  MinusCircle,
  Trash2,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import {
  getWorkspaceDocDownloadUrlAction,
  listProposalDocsAction,
  registerUploadedWorkspaceDocAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { CONDITION_RATINGS } from '~/lib/building-surveyor/condition-rating';
import {
  SURVEY_PHRASE_DRAG_MIME,
  parsePhraseDrag,
} from '~/lib/building-surveyor/phrase-insert-blocks';
import {
  type DeskReviewSection,
  adjacentDeskReviewSection,
} from '~/lib/building-surveyor/survey-desk-review';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { SurveyObservation } from '../_lib/schema/survey-capture.schema';
import {
  autoCaptionSurveyPhotosAction,
  createSurveyObservationAction,
  deleteSurveyObservationAction,
  reorderSurveyPhotosAction,
  updateSurveyObservationAction,
  updateSurveyPhotoCurationAction,
} from '../_lib/server/survey-capture-actions';
import { surveyPath } from '../_lib/survey-display';
import { SurveyPhrasePanel } from './survey-phrase-panel';
import { SurveySectionHeadingIcon } from './survey-section-heading-icon';

type DeskReviewPhoto = {
  id: string;
  title: string;
  mimeType: string | null;
  createdAt: string | null;
  pinnedSectionKey: string | null;
  photoRole?: 'archive' | 'curated';
  caption?: string | null;
  curatedSortOrder?: number | null;
};

function reviewHref(
  accountSlug: string,
  proposalId: string,
  sectionKey: string,
) {
  return surveyPath(
    pathsConfig.app.accountSurveyReviewSection,
    accountSlug,
    proposalId,
    sectionKey,
  );
}

export function SurveyDeskReviewClient({
  accountSlug,
  accountId,
  proposalId,
  canEdit,
  clientId,
  sections,
  currentKey,
  observations: initialObservations,
  phraseBankCount,
}: {
  accountSlug: string;
  accountId: string;
  proposalId: string;
  canEdit: boolean;
  clientId?: string | null;
  sections: DeskReviewSection[];
  currentKey: string;
  observations: SurveyObservation[];
  phraseBankCount: number;
}) {
  const router = useRouter();
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const captionedKey = useRef<string | null>(null);
  const [observations, setObservations] = useState(initialObservations);
  const [photos, setPhotos] = useState<DeskReviewPhoto[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newBody, setNewBody] = useState('');

  const current =
    sections.find((item) => item.key === currentKey) ?? sections[0] ?? null;
  const { previous, next } = adjacentDeskReviewSection(sections, currentKey);
  const sectionObservations = useMemo(
    () => observations.filter((item) => item.sectionKey === currentKey),
    [observations, currentKey],
  );
  const notedKeys = useMemo(
    () => new Set(observations.map((item) => item.sectionKey)),
    [observations],
  );
  const sectionsWithNotes = sections.filter((item) =>
    notedKeys.has(item.key),
  ).length;
  const sectionPhotos = useMemo(
    () =>
      photos
        .filter((photo) => photo.pinnedSectionKey === currentKey)
        .sort(
          (a, b) => (a.curatedSortOrder ?? 99) - (b.curatedSortOrder ?? 99),
        ),
    [photos, currentKey],
  );
  const archivePhotos = useMemo(
    () => photos.filter((photo) => photo.pinnedSectionKey !== currentKey),
    [photos, currentKey],
  );

  const loadPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const result = await listProposalDocsAction({
        accountId,
        proposalId,
      });
      const items = ((result.items ?? []) as DeskReviewPhoto[]).filter(
        (item) => !item.mimeType || item.mimeType.startsWith('image/'),
      );
      setPhotos(items);
      const urls: Record<string, string> = {};
      await Promise.all(
        items.map(async (item) => {
          const signed = await getWorkspaceDocDownloadUrlAction({
            accountId,
            docId: item.id,
          });
          if (signed.url) urls[item.id] = signed.url;
        }),
      );
      setPreviews(urls);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingPhotos(false);
    }
  }, [accountId, proposalId]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    setObservations(initialObservations);
  }, [initialObservations]);

  useEffect(() => {
    if (!canEdit || !current || captionedKey.current === current.key) return;
    const needsCaption = sectionPhotos.some((photo) => !photo.caption?.trim());
    if (!needsCaption || loadingPhotos) return;
    captionedKey.current = current.key;
    setCaptioning(true);
    void autoCaptionSurveyPhotosAction({
      accountId,
      accountSlug,
      proposalId,
      sectionKey: current.key,
    })
      .then(async (result) => {
        if (result.updated > 0) {
          await loadPhotos();
        }
      })
      .catch(() => {
        captionedKey.current = null;
      })
      .finally(() => setCaptioning(false));
  }, [
    accountId,
    accountSlug,
    canEdit,
    current,
    loadingPhotos,
    loadPhotos,
    proposalId,
    sectionPhotos,
  ]);

  const saveObservation = (observation: SurveyObservation, body: string) => {
    startTransition(async () => {
      try {
        const next = await updateSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          observationId: observation.id,
          body,
        });
        setObservations((prev) =>
          prev.map((row) => (row.id === next.id ? next : row)),
        );
        toast.success('Note saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const updateRating = (
    observation: SurveyObservation,
    conditionRating: SurveyObservation['conditionRating'],
  ) => {
    setObservations((prev) =>
      prev.map((row) =>
        row.id === observation.id ? { ...row, conditionRating } : row,
      ),
    );
    startTransition(async () => {
      try {
        await updateSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          observationId: observation.id,
          conditionRating,
        });
      } catch (error) {
        setObservations((prev) =>
          prev.map((row) => (row.id === observation.id ? observation : row)),
        );
        toast.error(getErrorMessage(error));
      }
    });
  };

  const moveObservation = (
    observation: SurveyObservation,
    sectionKey: string,
  ) => {
    if (sectionKey === observation.sectionKey) return;
    const target = sections.find((item) => item.key === sectionKey);
    setObservations((prev) =>
      prev.map((row) =>
        row.id === observation.id ? { ...row, sectionKey } : row,
      ),
    );
    startTransition(async () => {
      try {
        await updateSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          observationId: observation.id,
          sectionKey,
        });
        toast.success(`Note moved to ${target?.label ?? 'another section'}`, {
          action: {
            label: 'Go there',
            onClick: () =>
              router.push(reviewHref(accountSlug, proposalId, sectionKey)),
          },
        });
      } catch (error) {
        setObservations((prev) =>
          prev.map((row) => (row.id === observation.id ? observation : row)),
        );
        toast.error(getErrorMessage(error));
      }
    });
  };

  const deleteObservation = (observation: SurveyObservation) => {
    if (!window.confirm('Delete this note?')) return;
    startTransition(async () => {
      try {
        await deleteSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          observationId: observation.id,
        });
        setObservations((prev) =>
          prev.filter((row) => row.id !== observation.id),
        );
        toast.success('Note deleted');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const insertPhraseBlock = (body: string, defaultRating?: string | null) => {
    const trimmed = body.trim();
    if (!trimmed || !current || !canEdit) return;
    startTransition(async () => {
      try {
        const created = await createSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          sectionKey: current.key,
          body: trimmed,
          conditionRating: defaultRating
            ? (defaultRating as SurveyObservation['conditionRating'])
            : undefined,
        });
        setObservations((prev) => [...prev, created]);
        toast.success('Phrase added as a new note');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const addObservation = () => {
    const body = newBody.trim();
    if (!body || !current) return;
    startTransition(async () => {
      try {
        const created = await createSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          sectionKey: current.key,
          body,
        });
        setObservations((prev) => [...prev, created]);
        setNewBody('');
        toast.success('Note added');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !canEdit || !current) return;
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
          pinnedSectionKey: current.key,
          photoRole: 'curated',
          link: clientId ? { type: 'client', id: clientId } : null,
        });
      }
      toast.success(
        files.length === 1 ? 'Photo added' : `${files.length} photos added`,
      );
      captionedKey.current = null;
      await loadPhotos();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const pinPhoto = async (docId: string, sectionKey: string | null) => {
    try {
      await updateSurveyPhotoCurationAction({
        accountId,
        accountSlug,
        proposalId,
        docId,
        sectionKey,
      });
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === docId
            ? {
                ...photo,
                pinnedSectionKey: sectionKey,
                photoRole: sectionKey ? 'curated' : 'archive',
              }
            : photo,
        ),
      );
      if (sectionKey) captionedKey.current = null;
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const saveCaption = async (docId: string, caption: string) => {
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
      toast.error(getErrorMessage(error));
    }
  };

  const reorder = async (docId: string, direction: -1 | 1) => {
    const index = sectionPhotos.findIndex((item) => item.id === docId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= sectionPhotos.length) {
      return;
    }
    const ordered = [...sectionPhotos];
    const [moved] = ordered.splice(index, 1);
    if (!moved) return;
    ordered.splice(nextIndex, 0, moved);
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
        sectionKey: currentKey,
        orderedDocIds: ordered.map((item) => item.id),
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
      await loadPhotos();
    }
  };

  if (!current) {
    return (
      <p className={workspaceTextMuted}>No sections for this survey level.</p>
    );
  }

  const groupedNav = sections.reduce<
    Array<{ group: string; items: DeskReviewSection[] }>
  >((groups, item) => {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      groups.push({ group: item.group, items: [item] });
    }
    return groups;
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] lg:sticky lg:top-4 lg:w-[15rem] lg:self-start">
        <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <p className={`text-sm font-semibold ${workspaceText}`}>Sections</p>
          <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
            {sectionsWithNotes} of {sections.length} have notes
          </p>
        </div>
        <nav className="max-h-[70vh] overflow-y-auto py-2">
          {groupedNav.map((group) => (
            <div key={group.group} className="px-2 py-1">
              <p
                className={`px-2 py-1 text-[11px] tracking-wide uppercase ${workspaceTextMuted}`}
              >
                {group.group}
              </p>
              <ul>
                {group.items.map((item) => {
                  const active = item.key === current.key;
                  return (
                    <li key={item.key}>
                      <Link
                        href={reviewHref(accountSlug, proposalId, item.key)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                          active
                            ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                            : workspaceText
                        }`}
                      >
                        <span className="w-6 shrink-0 text-xs tabular-nums opacity-70">
                          {item.index}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {notedKeys.has(item.key) ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ozer-accent)]"
                            aria-label="Has notes"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              className={`flex items-center gap-2 text-xl font-semibold ${workspaceText}`}
            >
              <SurveySectionHeadingIcon
                sectionKey={current.key}
                className="h-5 w-5 shrink-0"
              />
              {current.label}
            </h2>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Check the notes and photographs for this section. Drag phrases in
              from the phrase book.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!previous}
              onClick={() =>
                previous &&
                router.push(reviewHref(accountSlug, proposalId, previous.key))
              }
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!next}
              onClick={() =>
                next &&
                router.push(reviewHref(accountSlug, proposalId, next.key))
              }
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </header>

        <div
          className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}
          onDragOver={(event) => {
            if (
              event.dataTransfer.types.includes(SURVEY_PHRASE_DRAG_MIME) ||
              event.dataTransfer.types.includes(
                SURVEY_PHRASE_DRAG_MIME.toLowerCase(),
              )
            ) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            const payload = parsePhraseDrag(
              event.dataTransfer.getData(SURVEY_PHRASE_DRAG_MIME) ||
                event.dataTransfer.getData(
                  SURVEY_PHRASE_DRAG_MIME.toLowerCase(),
                ),
            );
            if (!payload) return;
            event.preventDefault();
            insertPhraseBlock(payload.body, payload.defaultRating);
          }}
        >
          <h3 className={`text-sm font-semibold ${workspaceText}`}>Notes</h3>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Cleaned-up site notes for this section. They feed the draft report.
          </p>
          {sectionObservations.length === 0 && !canEdit ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              No notes on this section yet.
            </p>
          ) : null}
          {sectionObservations.length > 0 ? (
            <ul className="space-y-3">
              {sectionObservations.map((item) => {
                const draft = drafts[item.id] ?? item.body;
                return (
                  <li
                    key={item.id}
                    className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3"
                  >
                    <Textarea
                      value={draft}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="min-h-28"
                      disabled={!canEdit}
                    />
                    {item.sourceBody && item.sourceBody !== item.body ? (
                      <details className={`text-xs ${workspaceTextMuted}`}>
                        <summary className="cursor-pointer">
                          Show original dictation
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap">
                          {item.sourceBody}
                        </p>
                      </details>
                    ) : null}
                    {canEdit ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Condition rating"
                          value={item.conditionRating ?? ''}
                          onChange={(event) =>
                            updateRating(
                              item,
                              (event.target.value ||
                                null) as SurveyObservation['conditionRating'],
                            )
                          }
                          className="h-8 rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 text-xs"
                        >
                          <option value="">No rating</option>
                          {CONDITION_RATINGS.map((rating) => (
                            <option key={rating} value={rating}>
                              Rating {rating}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Move to section"
                          value={item.sectionKey}
                          onChange={(event) =>
                            moveObservation(item, event.target.value)
                          }
                          className="h-8 max-w-56 rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 text-xs"
                        >
                          {sections.map((section) => (
                            <option key={section.key} value={section.key}>
                              {section.key === item.sectionKey
                                ? 'Move to section…'
                                : `${section.index} ${section.label}`}
                            </option>
                          ))}
                        </select>
                        <div className="ml-auto flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-500 hover:text-red-400"
                            aria-label="Delete note"
                            disabled={pending}
                            onClick={() => deleteObservation(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={pending || draft.trim() === item.body}
                            onClick={() => saveObservation(item, draft.trim())}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : item.conditionRating ? (
                      <p className={`text-xs ${workspaceTextMuted}`}>
                        Rating {item.conditionRating}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {canEdit ? (
            <div className="space-y-2">
              <Textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                placeholder={
                  sectionObservations.length === 0
                    ? 'No notes on this section yet. Type one here…'
                    : 'Add another note…'
                }
                className="min-h-24"
                data-test="survey-review-new-note"
              />
              <Button
                type="button"
                size="sm"
                className={workspaceBtnPrimaryMd}
                disabled={pending || !newBody.trim()}
                onClick={addObservation}
              >
                Add note
              </Button>
            </div>
          ) : null}
        </div>

        <div className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`text-sm font-semibold ${workspaceText}`}>
                Photographs
              </h3>
              <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                Shown below the notes, not interleaved. Empty captions are
                filled once; your wording is kept.
                {captioning ? ' Writing captions…' : ''}
              </p>
            </div>
            {canEdit && current.allowsPhotos ? (
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
                Add photo
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

          {loadingPhotos ? (
            <p className={`text-sm ${workspaceTextMuted}`}>Loading photos…</p>
          ) : !current.allowsPhotos ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              This field does not take site photographs.
            </p>
          ) : sectionPhotos.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              No photographs on this section yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {sectionPhotos.map((photo, index) => (
                <li
                  key={photo.id}
                  className="grid gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 sm:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <div className="overflow-hidden rounded-lg bg-[var(--workspace-shell-sidebar-accent)]">
                    {previews[photo.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previews[photo.id]}
                        alt={photo.caption || photo.title}
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div className="h-36" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className={`text-sm font-medium ${workspaceText}`}>
                      {photo.title}
                    </p>
                    <Textarea
                      value={photo.caption ?? ''}
                      onChange={(event) =>
                        setPhotos((prev) =>
                          prev.map((item) =>
                            item.id === photo.id
                              ? { ...item, caption: event.target.value }
                              : item,
                          ),
                        )
                      }
                      onBlur={(event) =>
                        void saveCaption(photo.id, event.target.value)
                      }
                      placeholder="Caption"
                      className="min-h-16"
                      disabled={!canEdit}
                    />
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={index === 0}
                          onClick={() => void reorder(photo.id, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={index === sectionPhotos.length - 1}
                          onClick={() => void reorder(photo.id, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void pinPhoto(photo.id, null)}
                        >
                          <MinusCircle className="mr-1 h-4 w-4" />
                          Remove from section
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canEdit && current.allowsPhotos && archivePhotos.length > 0 ? (
            <div className="border-t border-[color:var(--workspace-shell-border)] pt-3">
              <p className={`text-xs ${workspaceTextMuted}`}>
                Add from the survey archive
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {archivePhotos.slice(0, 12).map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      className="rounded-lg border border-[color:var(--workspace-shell-border)] px-2 py-1 text-xs"
                      onClick={() => void pinPhoto(photo.id, current.key)}
                    >
                      {photo.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <SurveyPhrasePanel
        accountId={accountId}
        sectionKey={current.key}
        ricsCode={current.ricsCode}
        canEdit={canEdit}
        onInsert={insertPhraseBlock}
        phraseBankCount={phraseBankCount}
        importHref={pathsConfig.app.accountSurveyPhrasesSettings.replace(
          '[account]',
          accountSlug,
        )}
      />
    </div>
  );
}
