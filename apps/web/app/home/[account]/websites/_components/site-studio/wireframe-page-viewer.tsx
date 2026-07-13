'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

export type WireframeViewerSectionMeta = {
  id: string;
  title: string;
  description?: string;
  notes?: string;
};

type WireframePageViewerProps = {
  pageTitle: string;
  pageDescription?: string;
  sections: WireframeViewerSectionMeta[];
  /** Continuous browser-like page canvas (no per-section chrome). */
  renderSection: (sectionId: string) => ReactNode;
  footer?: ReactNode;
  /** Optional toolbar above the canvas (library controls, etc.). */
  canvasHeader?: ReactNode;
  canEditNotes?: boolean;
  onNotesChange?: (sectionId: string, notes: string) => void;
  /** Extra controls per section in the left rail (e.g. library picker). */
  renderSectionControls?: (sectionId: string) => ReactNode;
  className?: string;
  /** When true, fills a fixed modal viewport. */
  fullViewport?: boolean;
};

export function WireframePageViewer({
  pageTitle,
  pageDescription,
  sections,
  renderSection,
  footer,
  canvasHeader,
  canEditNotes = false,
  onNotesChange,
  renderSectionControls,
  className,
  fullViewport = false,
}: WireframePageViewerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    sections[0]?.id ?? null,
  );
  const [expandedDescriptions, setExpandedDescriptions] = useState<
    Record<string, boolean>
  >({});
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(sections[0]?.id ?? null);
    }
  }, [sections, activeSectionId]);

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const el = sectionRefs.current.get(sectionId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={cn(
        'flex min-h-0 w-full overflow-hidden bg-[var(--ozer-cream-50)]',
        fullViewport ? 'h-full flex-1' : 'min-h-[32rem] rounded-2xl border border-[color:var(--workspace-shell-border)]',
        className,
      )}
    >
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-[color:var(--workspace-shell-border)] bg-white transition-[width] duration-200',
          sidebarOpen ? 'w-[min(100%,18rem)] sm:w-72' : 'w-12',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-2 py-2">
          {sidebarOpen ? (
            <div className="min-w-0 px-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
                Sections
              </p>
              <p className="truncate text-sm font-medium text-[var(--ozer-plum-900)]">
                {pageTitle}
              </p>
            </div>
          ) : (
            <span className="sr-only">Sections</span>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Collapse sections' : 'Expand sections'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
        </div>

        {sidebarOpen ? (
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {pageDescription ? (
              <p className="rounded-lg bg-[var(--ozer-cream-50)] px-3 py-2 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                {pageDescription}
              </p>
            ) : null}

            {sections.length === 0 ? (
              <p className="px-2 py-4 text-sm text-[var(--workspace-shell-text-muted)]">
                No sections yet.
              </p>
            ) : (
              sections.map((section, index) => {
                const descriptionOpen = Boolean(
                  expandedDescriptions[section.id],
                );
                const isActive = section.id === activeSectionId;

                return (
                  <div
                    key={section.id}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 transition-colors',
                      isActive
                        ? 'border-[var(--ozer-accent)]/40 bg-[color-mix(in_srgb,var(--ozer-accent)_8%,white)]'
                        : 'border-[color:var(--workspace-shell-border)] bg-white',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className="flex w-full items-start gap-2 text-left"
                    >
                      <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-[var(--workspace-shell-text-muted)]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--ozer-plum-900)]">
                        {section.title || 'Untitled section'}
                      </span>
                    </button>

                    {section.description ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDescriptions((current) => ({
                              ...current,
                              [section.id]: !current[section.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-plum-900)]"
                        >
                          {descriptionOpen ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Description
                        </button>
                        {descriptionOpen ? (
                          <p className="mt-1 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                            {section.description}
                          </p>
                        ) : (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                            {section.description}
                          </p>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
                        Notes
                      </p>
                      {canEditNotes ? (
                        <Textarea
                          value={section.notes ?? ''}
                          rows={2}
                          onChange={(event) =>
                            onNotesChange?.(section.id, event.target.value)
                          }
                          placeholder="Internal notes…"
                          className="min-h-[4rem] border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)] text-xs text-[var(--ozer-plum-900)]"
                        />
                      ) : section.notes ? (
                        <p className="text-xs leading-relaxed text-[var(--ozer-plum-900)]/80">
                          {section.notes}
                        </p>
                      ) : (
                        <p className="text-xs italic text-[var(--workspace-shell-text-muted)]">
                          No notes
                        </p>
                      )}
                    </div>

                    {renderSectionControls ? (
                      <div className="mt-2 border-t border-[color:var(--workspace-shell-border)] pt-2">
                        {renderSectionControls(section.id)}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-3">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                title={section.title}
                onClick={() => {
                  setSidebarOpen(true);
                  queueMicrotask(() => scrollToSection(section.id));
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-semibold',
                  section.id === activeSectionId
                    ? 'bg-[var(--ozer-accent)] text-white'
                    : 'bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)] hover:bg-[color-mix(in_srgb,var(--ozer-accent)_12%,white)]',
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {canvasHeader ? (
          <div className="border-b border-[color:var(--workspace-shell-border)] bg-white px-4 py-2">
            {canvasHeader}
          </div>
        ) : null}

        <div ref={canvasRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl bg-white shadow-[0_0_0_1px_rgba(42,23,32,0.06)]">
            {sections.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-[var(--workspace-shell-text-muted)]">
                No wireframe sections to preview yet.
              </div>
            ) : (
              sections.map((section) => (
                <section
                  key={section.id}
                  id={`wireframe-section-${section.id}`}
                  ref={(node) => {
                    if (node) sectionRefs.current.set(section.id, node);
                    else sectionRefs.current.delete(section.id);
                  }}
                  className={cn(
                    'scroll-mt-4 border-b border-[color:var(--workspace-shell-border)]/40 last:border-b-0',
                    section.id === activeSectionId &&
                      'ring-1 ring-inset ring-[var(--ozer-accent)]/25',
                  )}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  {renderSection(section.id)}
                </section>
              ))
            )}
          </div>

          {footer ? (
            <div className="border-t border-[color:var(--workspace-shell-border)] bg-white px-4 py-4 sm:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
