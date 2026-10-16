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

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  Loader2,
  MinusCircle,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Skeleton } from '@kit/ui/skeleton';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  getWorkspaceDocDownloadUrlAction,
  listProposalDocsAction,
  registerUploadedWorkspaceDocAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { brochurePillLabel } from '~/lib/building-surveyor/brochure-import';
import {
  CONDITION_RATINGS,
  CONDITION_RATING_COLORS,
  CONDITION_RATING_LABELS,
  hasMixedConditionRatings,
  sectionConditionRating,
} from '~/lib/building-surveyor/condition-rating';
import {
  appendSurveySectionNote,
  joinSectionNoteBodies,
} from '~/lib/building-surveyor/merge-section-notes';
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
  reorderSurveyPhotosAction,
  setSurveySectionRatingAction,
  updateSurveyObservationAction,
  updateSurveyPhotoCurationAction,
} from '../_lib/server/survey-capture-actions';
import { updateSurveyCoverAction } from '../_lib/server/survey-report-details-actions';
import { surveyPath } from '../_lib/survey-display';
import { AutoGrowTextarea } from './auto-grow-textarea';
import { SurveyPhrasePanel } from './survey-phrase-panel';
import { SurveySectionHeadingIcon } from './survey-section-heading-icon';

const NI_REASON_RE =
  /\b(access|unable|could not|couldn't|not possible|obscured|covered|locked|hidden|because|due to|unsafe|safe)\b/i;

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

function reviewSectionKeyFromPath(pathname: string) {
  const marker = '/review/';
  const index = pathname.lastIndexOf(marker);
  if (index < 0) return null;
  const key = decodeURIComponent(
    pathname.slice(index + marker.length).split('/')[0] ?? '',
  );
  return key || null;
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
  coverPhotoDocId: initialCoverPhotoDocId,
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
  coverPhotoDocId: string | null;
}) {
  const supabase = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const contentTopRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const captionedKey = useRef<string | null>(null);
  const localCreatedIds = useRef<Set<string>>(new Set());
  const [observations, setObservations] = useState(initialObservations);
  const [coverPhotoDocId, setCoverPhotoDocId] = useState(
    initialCoverPhotoDocId,
  );
  const [photos, setPhotos] = useState<DeskReviewPhoto[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [captioning, setCaptioning] = useState(false);
  const [pending, startTransition] = useTransition();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState(currentKey);
  const pendingSectionFocus = useRef(false);

  const goToSection = useCallback(
    (sectionKey: string) => {
      if (sectionKey === activeKey) return;
      if (!sections.some((item) => item.key === sectionKey)) return;
      pendingSectionFocus.current = true;
      setActiveKey(sectionKey);
      window.history.pushState(
        null,
        '',
        reviewHref(accountSlug, proposalId, sectionKey),
      );
    },
    [accountSlug, activeKey, proposalId, sections],
  );

  const current =
    sections.find((item) => item.key === activeKey) ?? sections[0] ?? null;
  const { previous, next } = adjacentDeskReviewSection(sections, activeKey);
  const sectionObservations = useMemo(
    () =>
      observations
        .filter((item) => item.sectionKey === activeKey)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [observations, activeKey],
  );
  const noteText = (item: SurveyObservation) =>
    noteDrafts[item.id] ?? item.body;
  const notesDirty = sectionObservations.some(
    (item) =>
      noteDrafts[item.id] !== undefined && noteDrafts[item.id] !== item.body,
  );
  const joinedSectionBody = useMemo(
    () =>
      joinSectionNoteBodies(
        sectionObservations.map((item) => noteDrafts[item.id] ?? item.body),
      ),
    [noteDrafts, sectionObservations],
  );

  useEffect(() => {
    if (!focusNoteId) return;
    const field = document.querySelector<HTMLTextAreaElement>(
      `[data-note-id="${CSS.escape(focusNoteId)}"]`,
    );
    field?.focus();
    if (field) setFocusNoteId(null);
  }, [focusNoteId, sectionObservations]);
  const noteRatings = useMemo(
    () => sectionObservations.map((item) => item.conditionRating),
    [sectionObservations],
  );
  const sectionRating = sectionConditionRating(noteRatings);
  const ratingsDiffer = hasMixedConditionRatings(noteRatings);
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
        .filter((photo) => photo.pinnedSectionKey === activeKey)
        .sort(
          (a, b) => (a.curatedSortOrder ?? 99) - (b.curatedSortOrder ?? 99),
        ),
    [photos, activeKey],
  );
  const archivePhotos = useMemo(
    () => photos.filter((photo) => photo.pinnedSectionKey !== activeKey),
    [photos, activeKey],
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
    setObservations((prev) => {
      const serverIds = new Set(initialObservations.map((item) => item.id));
      for (const id of localCreatedIds.current) {
        if (serverIds.has(id)) localCreatedIds.current.delete(id);
      }
      const localOnly = prev.filter(
        (item) =>
          localCreatedIds.current.has(item.id) && !serverIds.has(item.id),
      );
      return localOnly.length === 0
        ? initialObservations
        : [...initialObservations, ...localOnly];
    });
  }, [initialObservations]);

  useEffect(() => {
    const key = reviewSectionKeyFromPath(window.location.pathname);
    if (!key || !sections.some((item) => item.key === key)) return;
    setActiveKey((prev) => (prev === key ? prev : key));
  }, [sections]);

  useEffect(() => {
    const onPopState = () => {
      const key = reviewSectionKeyFromPath(window.location.pathname);
      if (!key || !sections.some((item) => item.key === key)) return;
      pendingSectionFocus.current = true;
      setActiveKey(key);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [sections]);

  useEffect(() => {
    if (!pendingSectionFocus.current) return;
    pendingSectionFocus.current = false;
    headingRef.current?.focus({ preventScroll: true });
    const top = contentTopRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) {
      contentTopRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [activeKey]);

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

  /** One rating for the whole section; replaces any per-note ratings. */
  const updateSectionRating = (
    conditionRating: SurveyObservation['conditionRating'],
  ) => {
    if (!current) return;
    const sectionKey = current.key;
    const priorRatings = new Map(
      observations
        .filter((row) => row.sectionKey === sectionKey)
        .map((row) => [row.id, row.conditionRating] as const),
    );
    setObservations((prev) =>
      prev.map((row) =>
        row.sectionKey === sectionKey ? { ...row, conditionRating } : row,
      ),
    );
    startTransition(async () => {
      try {
        await setSurveySectionRatingAction({
          accountId,
          accountSlug,
          proposalId,
          sectionKey,
          conditionRating,
        });
      } catch (error) {
        setObservations((prev) =>
          prev.map((row) =>
            priorRatings.has(row.id)
              ? { ...row, conditionRating: priorRatings.get(row.id) ?? null }
              : row,
          ),
        );
        toast.error(getErrorMessage(error));
      }
    });
  };

  const saveNote = async (observationId: string, body: string) => {
    const updated = await updateSurveyObservationAction({
      accountId,
      accountSlug,
      proposalId,
      observationId,
      body,
    });
    setObservations((prev) =>
      prev.map((row) => (row.id === updated.id ? updated : row)),
    );
    setNoteDrafts((prev) => {
      if (prev[observationId] === undefined) return prev;
      const next = { ...prev };
      delete next[observationId];
      return next;
    });
  };

  const saveDirtyNotes = () => {
    if (!canEdit || !notesDirty) return;
    const pendingNotes = sectionObservations.filter(
      (item) =>
        noteDrafts[item.id] !== undefined && noteDrafts[item.id] !== item.body,
    );
    startTransition(async () => {
      try {
        for (const item of pendingNotes) {
          await saveNote(item.id, noteDrafts[item.id] ?? item.body);
        }
        toast.success('Notes saved');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const insertPhraseBlock = (body: string, defaultRating?: string | null) => {
    const trimmed = body.trim();
    if (!trimmed || !current || !canEdit) return;
    const target = sectionObservations[sectionObservations.length - 1] ?? null;
    startTransition(async () => {
      try {
        if (target) {
          const nextBody = appendSurveySectionNote(target.body, trimmed);
          const updated = await updateSurveyObservationAction({
            accountId,
            accountSlug,
            proposalId,
            observationId: target.id,
            body: nextBody,
            conditionRating: defaultRating
              ? (defaultRating as SurveyObservation['conditionRating'])
              : undefined,
          });
          setObservations((prev) =>
            prev.map((row) => (row.id === updated.id ? updated : row)),
          );
          setNoteDrafts((prev) => {
            if (prev[target.id] === undefined) return prev;
            const next = { ...prev };
            delete next[target.id];
            return next;
          });
          toast.success('Phrase added to note');
          return;
        }
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
        localCreatedIds.current.add(created.id);
        setObservations((prev) => [...prev, created]);
        toast.success('Phrase added as a note');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const addEmptyNote = () => {
    if (!current || !canEdit) return;
    startTransition(async () => {
      try {
        const created = await createSurveyObservationAction({
          accountId,
          accountSlug,
          proposalId,
          sectionKey: current.key,
          body: '',
        });
        localCreatedIds.current.add(created.id);
        setObservations((prev) => [...prev, created]);
        setFocusNoteId(created.id);
        toast.success('New note added');
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

  const setAsCover = (docId: string) => {
    startTransition(async () => {
      try {
        await updateSurveyCoverAction({
          accountId,
          accountSlug,
          proposalId,
          photoDocId: docId,
        });
        setCoverPhotoDocId(docId);
        toast.success('Cover photo set');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
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
        sectionKey: activeKey,
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
                        prefetch={false}
                        href={reviewHref(accountSlug, proposalId, item.key)}
                        aria-current={active ? 'page' : undefined}
                        onClick={(event) => {
                          if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.button !== 0
                          ) {
                            return;
                          }
                          event.preventDefault();
                          goToSection(item.key);
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150 active:scale-[0.98]',
                          active
                            ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                            : `${workspaceText} hover:bg-[var(--workspace-shell-panel-hover)]`,
                        )}
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

      <section
        ref={contentTopRef}
        key={current.key}
        className="animate-in fade-in slide-in-from-bottom-1 min-w-0 flex-1 scroll-mt-4 space-y-5 duration-200"
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className={`flex items-center gap-2 text-xl font-semibold ${workspaceText}`}
            >
              <SurveySectionHeadingIcon
                sectionKey={current.key}
                className="h-5 w-5 shrink-0"
              />
              {current.label}
            </h2>
            {canEdit || sectionRating ? (
              <div className="flex flex-wrap items-center gap-2">
                {sectionRating ? (
                  <span
                    className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white"
                    style={{
                      backgroundColor: CONDITION_RATING_COLORS[sectionRating],
                    }}
                    title={CONDITION_RATING_LABELS[sectionRating]}
                    data-test="survey-section-rating-badge"
                  >
                    {sectionRating}
                  </span>
                ) : null}
                {canEdit ? (
                  <select
                    aria-label="Section condition rating"
                    value={sectionRating ?? ''}
                    disabled={sectionObservations.length === 0 || pending}
                    title={
                      sectionObservations.length === 0
                        ? 'Add a note to rate this section'
                        : undefined
                    }
                    onChange={(event) =>
                      updateSectionRating(
                        (event.target.value ||
                          null) as SurveyObservation['conditionRating'],
                      )
                    }
                    className="h-8 rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 text-xs disabled:opacity-60"
                    data-test="survey-section-rating-select"
                  >
                    <option value="">No rating</option>
                    {CONDITION_RATINGS.map((rating) => (
                      <option key={rating} value={rating}>
                        {CONDITION_RATING_LABELS[rating]}
                      </option>
                    ))}
                  </select>
                ) : null}
                {ratingsDiffer ? (
                  <span
                    className="text-xs text-amber-600 dark:text-amber-400"
                    data-test="survey-section-rating-mixed"
                  >
                    Some notes have their own rating. The report shows the
                    highest.
                  </span>
                ) : null}
              </div>
            ) : null}
            {canEdit &&
            sectionRating === 'NI' &&
            !NI_REASON_RE.test(joinedSectionBody) ? (
              <p
                className="text-xs text-amber-600 dark:text-amber-400"
                data-test="survey-ni-reason-prompt"
              >
                Not inspected: add why (for example no safe access, locked, or
                covered by stored items). RICS reports should explain every
                element that was not inspected.
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!previous}
              onClick={() => previous && goToSection(previous.key)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!next}
              onClick={() => next && goToSection(next.key)}
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
          <div className="flex items-center justify-between gap-3">
            <h3 className={`text-sm font-semibold ${workspaceText}`}>Notes</h3>
            {sectionObservations.length > 1 ? (
              <span className={`text-xs ${workspaceTextMuted}`}>
                {sectionObservations.length} notes
              </span>
            ) : null}
          </div>
          {sectionObservations.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              No notes on this section yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sectionObservations.map((item, index) => {
                const label = brochurePillLabel({
                  origin: item.origin,
                  body: item.body,
                  originBody: item.originBody,
                });
                return (
                  <div key={item.id} className="space-y-1.5">
                    {sectionObservations.length > 1 || label ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs ${workspaceTextMuted}`}>
                          Note {index + 1}
                        </span>
                        {label ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-[var(--workspace-shell-accent-text)] uppercase">
                            {label}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <AutoGrowTextarea
                      value={noteText(item)}
                      onChange={(event) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) => {
                        const draft = event.currentTarget.value;
                        if (draft === item.body) return;
                        startTransition(async () => {
                          try {
                            await saveNote(item.id, draft);
                          } catch (error) {
                            toast.error(getErrorMessage(error));
                          }
                        });
                      }}
                      placeholder="Write this note…"
                      className="min-h-36"
                      disabled={!canEdit}
                      data-note-id={item.id}
                      data-test="survey-review-note"
                    />
                  </div>
                );
              })}
            </div>
          )}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className={workspaceBtnPrimaryMd}
                disabled={pending || !notesDirty}
                onClick={saveDirtyNotes}
                data-test="survey-review-save-notes"
              >
                Save notes
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={addEmptyNote}
                data-test="survey-review-add-note"
              >
                Add new note
              </Button>
            </div>
          ) : null}
        </div>

        <div className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}>
          <div className="flex items-center justify-between gap-3">
            <h3
              className={`flex items-center gap-2 text-sm font-semibold ${workspaceText}`}
            >
              Photographs
              {captioning ? (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-normal ${workspaceTextMuted}`}
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Writing captions…
                </span>
              ) : null}
            </h3>
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
            <div className="space-y-3" aria-label="Loading photos">
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 sm:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <Skeleton className="h-36 rounded-lg bg-[var(--workspace-shell-sidebar-accent)]" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40 bg-[var(--workspace-shell-sidebar-accent)]" />
                    <Skeleton className="h-16 w-full bg-[var(--workspace-shell-sidebar-accent)]" />
                  </div>
                </div>
              ))}
            </div>
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
                    <AutoGrowTextarea
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || coverPhotoDocId === photo.id}
                          onClick={() => setAsCover(photo.id)}
                          data-test="survey-photo-use-as-cover"
                        >
                          {coverPhotoDocId === photo.id ? (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              Cover photo
                            </>
                          ) : (
                            'Use as cover photo'
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canEdit && archivePhotos.length > 0 ? (
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
