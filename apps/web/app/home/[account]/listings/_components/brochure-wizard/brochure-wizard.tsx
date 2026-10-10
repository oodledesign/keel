'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Check, Loader2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type BrochureDisplayOptions,
  type BrochureOrientation,
  type BrochurePage,
  type BrochureRenderWarning,
  type BrochureTemplateId,
  DEFAULT_BROCHURE_DISPLAY_OPTIONS,
} from '~/lib/commercial/brochure-pdf/brochure-document';

import {
  getListingBrochureDocument,
  loadBrochureWizard,
  publishListingBrochurePdf,
  regenerateListingBrochure,
  saveListingBrochureDocument,
} from '../../_lib/server/brochure-actions';
import { BrochureApproveStep } from './brochure-approve-step';
import { BrochurePagesStep } from './brochure-pages-step';
import { BrochurePreviewStep } from './brochure-preview-step';
import { BrochureSetupStep } from './brochure-setup-step';

export type BrochureWizardChannel = { id: string; label: string; on: boolean };

export type BrochureWizardData = Awaited<ReturnType<typeof loadBrochureWizard>>;

export type BrochurePreviewResult = {
  url: string;
  filename: string;
  pageIds: string[];
  warnings: BrochureRenderWarning[];
  updatedAt: string | null;
};

type Step = 'setup' | 'pages' | 'preview' | 'approve';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'setup', label: 'Set up' },
  { id: 'pages', label: 'Review pages' },
  { id: 'preview', label: 'Check the PDF' },
  { id: 'approve', label: 'Approve' },
];

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type WorkingDoc = {
  templateId: BrochureTemplateId;
  orientation: BrochureOrientation;
};

const RENDER_FLAGS = [
  'showReducedPrice',
  'showWebsiteListingButton',
  'showSlideshowBrochureButton',
] as const;

function filenameFrom(header: string | null, fallback: string) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

function parseWarnings(header: string | null): BrochureRenderWarning[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header));
    return Array.isArray(parsed) ? (parsed as BrochureRenderWarning[]) : [];
  } catch {
    return [];
  }
}

/**
 * Full-screen brochure flow: set up, review and edit pages, check the real
 * PDF, then approve and download or publish.
 */
export function BrochureWizard({
  listingId,
  accountId,
  listingName,
  initialOrientation = 'landscape',
  defaultShowRent = true,
  defaultShowPrice = true,
  channels,
  onClose,
}: {
  listingId: string;
  accountId: string;
  listingName: string;
  initialOrientation?: BrochureOrientation;
  defaultShowRent?: boolean;
  defaultShowPrice?: boolean;
  channels: BrochureWizardChannel[];
  onClose: () => void;
}) {
  const [data, setData] = useState<BrochureWizardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('setup');
  const [busy, setBusy] = useState(false);

  const [orientation, setOrientation] =
    useState<BrochureOrientation>(initialOrientation);
  const [templateId, setTemplateId] = useState<BrochureTemplateId>('classic');
  const [display, setDisplay] = useState<BrochureDisplayOptions>({
    ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
    showRent: defaultShowRent,
    showPrice: defaultShowPrice,
  });

  const [doc, setDoc] = useState<WorkingDoc | null>(null);
  const [pages, setPages] = useState<BrochurePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const [preview, setPreview] = useState<BrochurePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [warnedPageIds, setWarnedPageIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const docRef = useRef<WorkingDoc | null>(null);
  const pagesRef = useRef<BrochurePage[]>([]);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadBrochureWizard({ listingId, accountId })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        const saved = result.saved[initialOrientation];
        if (saved) setTemplateId(saved.templateId);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Could not load the brochure',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listingId, accountId, initialOrientation]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  /** Also invalidates any preview request still in flight. */
  const clearPreview = useCallback(() => {
    previewRequest.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
    setPreviewLoading(false);
    setApproved(false);
  }, []);

  const flushSave = useCallback((): Promise<void> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const run = async () => {
      const current = docRef.current;
      if (!current || revision.current === savedRevision.current) return;
      const rev = revision.current;
      setSaveState('saving');
      try {
        await saveListingBrochureDocument({
          listingId,
          accountId,
          templateId: current.templateId,
          orientation: current.orientation,
          pages: pagesRef.current,
        });
        savedRevision.current = rev;
        setSaveState(revision.current === rev ? 'saved' : 'dirty');
      } catch (err) {
        setSaveState('error');
        throw err;
      }
    };
    saveChain.current = saveChain.current.catch(() => undefined).then(run);
    return saveChain.current;
  }, [listingId, accountId]);

  const markEdited = useCallback(() => {
    revision.current += 1;
    setSaveState('dirty');
    clearPreview();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flushSave().catch(() => undefined);
    }, 800);
  }, [clearPreview, flushSave]);

  const editPages = useCallback(
    (update: (pages: BrochurePage[]) => BrochurePage[]) => {
      const next = update(pagesRef.current);
      pagesRef.current = next;
      setPages(next);
      markEdited();
    },
    [markEdited],
  );

  function loadDoc(next: {
    templateId: BrochureTemplateId;
    orientation: BrochureOrientation;
    pages: BrochurePage[];
  }) {
    const working = {
      templateId: next.templateId,
      orientation: next.orientation,
    };
    docRef.current = working;
    pagesRef.current = next.pages;
    revision.current = 0;
    savedRevision.current = 0;
    setDoc(working);
    setPages(next.pages);
    setSelectedPageId(next.pages[0]?.id ?? null);
    setSaveState('idle');
    setWarnedPageIds(new Set());
    clearPreview();
  }

  async function startPages(mode: 'continue' | 'fresh') {
    setBusy(true);
    try {
      if (mode === 'continue') {
        const saved = await getListingBrochureDocument({
          listingId,
          accountId,
          orientation,
        });
        loadDoc(saved);
        if (saved.templateId !== templateId) {
          docRef.current = { templateId, orientation: saved.orientation };
          setDoc(docRef.current);
          markEdited();
        }
      } else {
        const fresh = await regenerateListingBrochure({
          listingId,
          accountId,
          orientation,
          templateId,
          display,
        });
        loadDoc(fresh);
      }
      setStep('pages');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not set up the brochure',
      );
    } finally {
      setBusy(false);
    }
  }

  const buildPreview = useCallback(async () => {
    const current = docRef.current;
    if (!current) return;
    clearPreview();
    const request = previewRequest.current;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      await flushSave();
      const params = new URLSearchParams({
        listingId,
        accountId,
        orientation: current.orientation,
        template: current.templateId,
        useSaved: '1',
      });
      for (const flag of RENDER_FLAGS) {
        params.set(flag, display[flag] ? '1' : '0');
      }
      const res = await fetch(`/api/listings/brochure-pdf?${params}`);
      if (!res.ok) throw new Error('The PDF could not be built.');
      const blob = await res.blob();
      if (request !== previewRequest.current) return;
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      const warnings = parseWarnings(res.headers.get('X-Brochure-Warnings'));
      setWarnedPageIds(new Set(warnings.map((w) => w.pageId)));
      setPreview({
        url,
        filename: filenameFrom(
          res.headers.get('Content-Disposition'),
          `${listingName || 'brochure'}.pdf`,
        ),
        pageIds: (res.headers.get('X-Brochure-Page-Ids') ?? '')
          .split(',')
          .filter(Boolean),
        warnings,
        updatedAt: res.headers.get('X-Brochure-Updated-At'),
      });
    } catch (err) {
      if (request !== previewRequest.current) return;
      setPreviewError(
        err instanceof Error ? err.message : 'The PDF could not be built.',
      );
    } finally {
      if (request === previewRequest.current) setPreviewLoading(false);
    }
  }, [accountId, clearPreview, display, flushSave, listingId, listingName]);

  async function goTo(next: Step) {
    if (next === step) return;
    if (next === 'setup') {
      try {
        await flushSave();
      } catch {
        toast.error('Your latest edits could not be saved.');
        return;
      }
    }
    setStep(next);
    if (next === 'preview' && !preview) void buildPreview();
  }

  async function close() {
    try {
      await flushSave();
    } catch {
      if (
        !window.confirm(
          'Your latest edits could not be saved. Close anyway and lose them?',
        )
      ) {
        return;
      }
    }
    onClose();
  }

  async function publish() {
    if (!doc || !preview?.updatedAt) {
      toast.error('Check the PDF again before publishing.');
      return;
    }
    setBusy(true);
    try {
      await publishListingBrochurePdf({
        listingId,
        accountId,
        orientation: doc.orientation,
        approved: true,
        reviewedUpdatedAt: preview.updatedAt,
        display: {
          showReducedPrice: display.showReducedPrice,
          showWebsiteListingButton: display.showWebsiteListingButton,
          showSlideshowBrochureButton: display.showSlideshowBrochureButton,
        },
      });
      toast.success('Brochure published');
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not publish the brochure',
      );
    } finally {
      setBusy(false);
    }
  }

  const media = useMemo(
    () => (data ? [...data.images, ...data.floorplans] : []),
    [data],
  );
  const drawingIds = useMemo(
    () => new Set(media.filter((m) => m.isDrawing).map((m) => m.id)),
    [media],
  );

  const reachable: Record<Step, boolean> = {
    setup: true,
    pages: doc != null,
    preview: doc != null && pages.length > 0,
    approve: preview != null,
  };

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'dirty'
        ? 'Unsaved changes'
        : saveState === 'saved'
          ? 'All changes saved'
          : saveState === 'error'
            ? 'Not saved'
            : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workspace-shell-canvas)]">
      <header className="flex shrink-0 items-center gap-4 border-b border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
            Brochure
          </p>
          <h2 className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
            {listingName}
          </h2>
        </div>

        <nav aria-label="Brochure steps" className="mx-auto">
          <ol className="flex items-center gap-1">
            {STEPS.map((s, index) => {
              const active = s.id === step;
              const done =
                STEPS.findIndex((x) => x.id === step) > index &&
                reachable[s.id];
              return (
                <li key={s.id} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span className="h-px w-4 bg-[var(--workspace-shell-border)]" />
                  ) : null}
                  <button
                    type="button"
                    disabled={!reachable[s.id] || busy}
                    aria-current={active ? 'step' : undefined}
                    onClick={() => void goTo(s.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-40',
                      active
                        ? 'bg-[var(--ozer-accent)] text-white'
                        : 'text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
                        active
                          ? 'bg-white/25'
                          : 'bg-[var(--ozer-surface-panel-hover)]',
                      )}
                    >
                      {done ? <Check className="h-2.5 w-2.5" /> : index + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex items-center gap-3">
          {saveLabel ? (
            <span
              className={cn(
                'text-xs',
                saveState === 'error'
                  ? 'text-[var(--ozer-accent)]'
                  : 'text-[var(--workspace-shell-text-muted)]',
              )}
              aria-live="polite"
            >
              {saveLabel}
            </span>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close brochure"
            onClick={() => void close()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {loadError ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--workspace-shell-text-muted)]">
            {loadError}
          </div>
        ) : !data ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading listing details…
          </div>
        ) : step === 'setup' ? (
          <BrochureSetupStep
            data={data}
            orientation={orientation}
            templateId={templateId}
            display={display}
            busy={busy}
            onOrientationChange={(next) => {
              clearPreview();
              setOrientation(next);
              const saved = data.saved[next];
              if (saved) setTemplateId(saved.templateId);
            }}
            onTemplateChange={(next) => {
              clearPreview();
              setTemplateId(next);
            }}
            onDisplayChange={(next) => {
              clearPreview();
              setDisplay(next);
            }}
            onStart={(mode) => void startPages(mode)}
          />
        ) : step === 'pages' && doc ? (
          <BrochurePagesStep
            doc={doc}
            pages={pages}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            editPages={editPages}
            media={media}
            drawingIds={drawingIds}
            brandName={data.accountName ?? ''}
            brand={data.brand}
            warnedPageIds={warnedPageIds}
            onNext={() => void goTo('preview')}
          />
        ) : step === 'preview' ? (
          <BrochurePreviewStep
            preview={preview}
            loading={previewLoading}
            error={previewError}
            pages={pages}
            onRetry={() => void buildPreview()}
            onFixPage={(pageId) => {
              setSelectedPageId(pageId);
              setStep('pages');
            }}
            onBack={() => setStep('pages')}
            onNext={() => setStep('approve')}
          />
        ) : step === 'approve' && preview && doc ? (
          <BrochureApproveStep
            preview={preview}
            doc={doc}
            pageCount={pages.length}
            approved={approved}
            onApprovedChange={setApproved}
            channels={channels}
            busy={busy}
            onBack={() => setStep('preview')}
            onPublish={() => void publish()}
          />
        ) : null}
      </div>
    </div>
  );
}
