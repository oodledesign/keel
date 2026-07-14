'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquareWarning,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { WireframeLibrarySection } from '~/home/[account]/websites/_components/site-studio/wireframe-library-sections';
import { WireframePageViewer } from '~/home/[account]/websites/_components/site-studio/wireframe-page-viewer';
import {
  setPortalWebsiteApprovalAction,
  setWebsiteShareApproval,
  setWebsiteShareSectionComment,
} from '~/home/[account]/websites/_lib/server/site-studio-actions';
import {
  PLANNING_STATUS_OPTIONS,
  type WebsiteBrief,
  type WebsitePortalShareScope,
  type WebsiteShareScope,
  type WebsiteSitemapPage,
  type WebsiteStyleSystem,
  type WebsiteWireframePage,
  type WebsiteWireframeSection,
  portalSectionChipClass,
  portalStatusChipClass,
  sectionColor,
  sectionTypeMeta,
} from '~/lib/websites/planning-types';
import { ensureWireframeCopy } from '~/lib/websites/wireframe-copy';

type PlanningScope = WebsiteShareScope | WebsitePortalShareScope;
type PortalTab = 'brief' | 'sitemap' | 'wireframes' | 'design';

export type PortalApprovalAuth =
  | { mode: 'share'; token: string }
  | { mode: 'portal'; clientOrgId: string; websiteId: string };

const CARD_WIDTH = 'w-[min(100%,22rem)] shrink-0 sm:w-[22rem]';

async function submitClientApproval(
  auth: PortalApprovalAuth,
  input: {
    targetType: 'page' | 'section';
    targetId: string;
    pageId: string;
    status: 'approved' | 'blocked';
    note?: string;
  },
) {
  if (auth.mode === 'share') {
    return setWebsiteShareApproval({
      token: auth.token,
      targetType: input.targetType,
      targetId: input.targetId,
      pageId: input.pageId,
      status: input.status,
      note: input.note,
    });
  }

  return setPortalWebsiteApprovalAction({
    clientOrgId: auth.clientOrgId,
    websiteId: auth.websiteId,
    targetType: input.targetType,
    targetId: input.targetId,
    pageId: input.pageId,
    status: input.status,
    note: input.note,
  });
}

function scopeShowsWireframes(scope: PlanningScope) {
  return scope === 'wireframes' || scope === 'design' || scope === 'full';
}

function scopeShowsStyle(scope: PlanningScope) {
  return scope === 'design' || scope === 'full';
}

/** Only allow http(s) links in client-facing brief references. */
function safeExternalHref(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function WireframePreview({ section }: { section: WebsiteWireframeSection }) {
  const copy = ensureWireframeCopy(section);

  return (
    <WireframeLibrarySection
      libraryKey={section.libraryKey}
      layout={section.layout}
      copy={copy}
      canEdit={false}
      onSlotChange={() => undefined}
      onItemSlotChange={() => undefined}
    />
  );
}

function statusMeta(status: WebsiteSitemapPage['status']) {
  return (
    PLANNING_STATUS_OPTIONS.find(
      (item) => item.value === (status ?? 'draft'),
    ) ?? PLANNING_STATUS_OPTIONS[0]!
  );
}

function PageApproval({
  page,
  approvalAuth,
  onUpdated,
  compact = false,
}: {
  page: WebsiteSitemapPage;
  approvalAuth: PortalApprovalAuth;
  onUpdated: (
    pageId: string,
    status: 'approved' | 'blocked',
    note?: string,
  ) => void;
  /** Sidebar layout — expands the note field in place. */
  compact?: boolean;
}) {
  const [note, setNote] = useState(page.approvalNote ?? '');
  const [showNote, setShowNote] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (status: 'approved' | 'blocked') => {
    startTransition(async () => {
      try {
        await submitClientApproval(approvalAuth, {
          targetType: 'page',
          targetId: page.id,
          pageId: page.id,
          status,
          note: status === 'blocked' ? note : undefined,
        });
        onUpdated(page.id, status, status === 'blocked' ? note : undefined);
        toast.success(
          status === 'approved' ? 'Page approved' : 'Change request sent',
        );
        setShowNote(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save approval',
        );
      }
    });
  };

  return (
    <div
      className={cn(
        'space-y-2',
        !compact &&
          'mt-auto border-t border-[color:var(--workspace-shell-border)] pt-3',
      )}
    >
      {compact ? (
        <p className="text-xs font-semibold text-[var(--ozer-plum-900)]">
          Page feedback
        </p>
      ) : null}
      {page.approvalNote && !showNote ? (
        <p className="text-xs leading-relaxed text-red-700">
          Requested: {page.approvalNote}
        </p>
      ) : null}
      <div className={cn('flex gap-2', compact ? 'flex-col' : 'flex-wrap')}>
        <Button
          type="button"
          size="sm"
          className={cn('ozer-gradient-btn', compact && 'w-full')}
          disabled={pending}
          onClick={() => submit('approved')}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Approve page
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={compact ? 'w-full' : undefined}
          disabled={pending}
          onClick={() => setShowNote((value) => !value)}
        >
          <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" />
          Request changes
        </Button>
      </div>
      {showNote ? (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should we change on this page?"
            rows={compact ? 4 : 3}
            className="border-[color:var(--workspace-shell-border)] bg-white text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !note.trim()}
              onClick={() => submit('blocked')}
              className={compact ? 'flex-1' : undefined}
            >
              Send feedback
            </Button>
            {compact ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setShowNote(false)}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionApproval({
  pageId,
  sectionId,
  sectionTitle,
  status,
  approvalAuth,
  onUpdated,
}: {
  pageId: string;
  sectionId: string;
  sectionTitle: string;
  status?: string;
  approvalAuth: PortalApprovalAuth;
  onUpdated: (
    pageId: string,
    sectionId: string,
    status: 'approved' | 'blocked',
  ) => void;
}) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (next: 'approved' | 'blocked') => {
    startTransition(async () => {
      try {
        await submitClientApproval(approvalAuth, {
          targetType: 'section',
          targetId: sectionId,
          pageId,
          status: next,
          note: next === 'blocked' ? note : undefined,
        });
        onUpdated(pageId, sectionId, next);
        toast.success(
          next === 'approved'
            ? `Approved “${sectionTitle || 'section'}”`
            : 'Section change request sent',
        );
        setShowNote(false);
        setNote('');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save approval',
        );
      }
    });
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[10px] font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        Section · {status ?? 'draft'}
      </p>
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-full justify-start px-2 text-xs"
          disabled={pending}
          onClick={() => submit('approved')}
        >
          <Check className="mr-1.5 h-3 w-3" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-full justify-start px-2 text-xs"
          disabled={pending}
          onClick={() => setShowNote((v) => !v)}
        >
          <MessageSquareWarning className="mr-1.5 h-3 w-3" />
          Request changes
        </Button>
      </div>
      {showNote ? (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What should change in this section?"
            rows={3}
            className="border-[color:var(--workspace-shell-border)] bg-white text-xs"
          />
          <Button
            type="button"
            size="sm"
            className="h-8 w-full text-xs"
            disabled={pending || !note.trim()}
            onClick={() => submit('blocked')}
          >
            Send feedback
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function HorizontalScroller({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      observer.disconnect();
    };
  }, [children]);

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * (el.clientWidth * 0.85),
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Scroll sideways or use the arrows to browse {label}.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            disabled={!canPrev}
            onClick={() => scrollByCard(-1)}
            aria-label={`Previous ${label}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            disabled={!canNext}
            onClick={() => scrollByCard(1)}
            aria-label={`Next ${label}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  const trimmed = value.trim();
  return (
    <div className="space-y-1 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {label}
      </p>
      <p
        className={cn(
          'text-sm leading-relaxed whitespace-pre-wrap',
          trimmed
            ? 'text-[var(--ozer-plum-900)]'
            : 'text-[var(--workspace-shell-text-muted)] italic',
        )}
      >
        {trimmed || 'Not provided yet'}
      </p>
    </div>
  );
}

function BriefTab({ brief }: { brief: WebsiteBrief }) {
  const stackLabel =
    brief.stackPreference === 'undecided'
      ? 'Undecided'
      : brief.stackPreference === 'webflow'
        ? 'Webflow (Client-First)'
        : brief.stackPreference === 'astro'
          ? 'Astro'
          : brief.stackPreference === 'next'
            ? 'Next.js'
            : brief.stackPreference === 'ozer_sites'
              ? 'Ozer Sites'
              : brief.stackPreference;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <BriefField label="Organisation" value={brief.org.name} />
      <BriefField label="Sector" value={brief.org.sector} />
      <BriefField label="One-liner" value={brief.org.oneLiner} />
      <BriefField label="Geography" value={brief.org.geography} />
      <BriefField label="Tone" value={brief.brand.tone.join(', ')} />
      <BriefField
        label="Constraints"
        value={brief.brand.constraints.join('; ')}
      />
      <BriefField
        label="Services"
        value={brief.offer.services
          .map((service) => `${service.name}: ${service.description}`)
          .join('\n')}
      />
      <BriefField
        label="Conversion goals"
        value={brief.offer.primaryConversionGoals.join('; ')}
      />
      <BriefField
        label="Audience"
        value={brief.audience.segments
          .map(
            (segment) =>
              `${segment.name} — ${segment.jobsToBeDone}${
                segment.objections.length
                  ? ` (objections: ${segment.objections.join(', ')})`
                  : ''
              }`,
          )
          .join('\n')}
      />
      <BriefField
        label="Questions the site must answer"
        value={brief.conversation.questionsTheSiteMustAnswer.join('\n')}
      />
      <BriefField
        label="Competitors"
        value={brief.competitors
          .map((row) => `${row.name} (${row.url}): ${row.notes}`)
          .join('\n')}
      />
      <BriefField label="Target stack" value={stackLabel} />
      <div className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white p-4 md:col-span-2">
        <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          References
        </p>
        {brief.references.length > 0 ? (
          <ul className="space-y-2">
            {brief.references.map((ref) => {
              const href = safeExternalHref(ref.url);
              return (
                <li key={`${ref.url}-${ref.whyThisWorks}`} className="text-sm">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[var(--ozer-accent)] hover:underline"
                    >
                      {ref.url}
                    </a>
                  ) : (
                    <span className="font-medium text-[var(--ozer-plum-900)]">
                      {ref.url}
                    </span>
                  )}
                  {ref.whyThisWorks ? (
                    <p className="text-[var(--workspace-shell-text-muted)]">
                      {ref.whyThisWorks}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--workspace-shell-text-muted)] italic">
            Not provided yet
          </p>
        )}
      </div>
    </div>
  );
}

export function PortalWebsitePlanningView({
  scope,
  sitemap,
  wireframes,
  style,
  brief = null,
  shareToken,
  approvalAuth,
  websiteName,
}: {
  scope: PlanningScope;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  style: WebsiteStyleSystem | null;
  brief?: WebsiteBrief | null;
  /** @deprecated Prefer approvalAuth — kept for token share callers. */
  shareToken?: string;
  approvalAuth?: PortalApprovalAuth;
  websiteName?: string;
}) {
  const resolvedAuth = useMemo<PortalApprovalAuth | null>(
    () =>
      approvalAuth ??
      (shareToken ? { mode: 'share', token: shareToken } : null),
    [approvalAuth, shareToken],
  );
  const canEditClientComments = resolvedAuth?.mode === 'share';

  const [pages, setPages] = useState(sitemap);
  const [wireframePagesState, setWireframePagesState] = useState(wireframes);
  const [selectedTab, setSelectedTab] = useState<PortalTab | null>(null);
  const [openWireframePageId, setOpenWireframePageId] = useState<string | null>(
    null,
  );
  const commentSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pendingSectionComments = useRef<
    Map<string, { pageId: string; sectionId: string; comment: string }>
  >(new Map());
  const shareTokenRef = useRef(
    resolvedAuth?.mode === 'share' ? resolvedAuth.token : undefined,
  );
  useEffect(() => {
    shareTokenRef.current =
      resolvedAuth?.mode === 'share' ? resolvedAuth.token : undefined;
  }, [resolvedAuth]);

  const showWireframes = scopeShowsWireframes(scope);
  const showStyle = scopeShowsStyle(scope);
  // Authenticated portal can show brief whenever the workspace shared planning;
  // public token shares only include brief for `full` scope (server-stripped).
  const showBrief =
    Boolean(brief) && (scope === 'full' || resolvedAuth?.mode === 'portal');

  const wireframeByPage = useMemo(() => {
    const map = new Map<string, WebsiteWireframePage>();
    for (const page of wireframePagesState) {
      map.set(page.pageId, page);
    }
    return map;
  }, [wireframePagesState]);

  const wireframePages = useMemo(
    () =>
      pages.filter((page) => {
        const wireframe = wireframeByPage.get(page.id);
        return Boolean(wireframe && wireframe.sections.length > 0);
      }),
    [pages, wireframeByPage],
  );

  const tabs = useMemo(() => {
    const items: Array<{ id: PortalTab; label: string }> = [];
    if (showBrief) items.push({ id: 'brief', label: 'Brief' });
    if (pages.length > 0) items.push({ id: 'sitemap', label: 'Sitemap' });
    if (showWireframes && wireframePages.length > 0) {
      items.push({ id: 'wireframes', label: 'Wireframes' });
    }
    if (showStyle && style) items.push({ id: 'design', label: 'Design' });
    return items;
  }, [
    showBrief,
    pages.length,
    showWireframes,
    wireframePages.length,
    showStyle,
    style,
  ]);

  const activeTab: PortalTab =
    selectedTab && tabs.some((tab) => tab.id === selectedTab)
      ? selectedTab
      : (tabs[0]?.id ?? 'sitemap');

  useEffect(() => {
    if (!openWireframePageId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenWireframePageId(null);
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [openWireframePageId]);

  const flushPendingSectionComments = useCallback(() => {
    const token = shareTokenRef.current;
    for (const timer of commentSaveTimers.current.values()) {
      clearTimeout(timer);
    }
    commentSaveTimers.current.clear();

    if (!token) {
      pendingSectionComments.current.clear();
      return;
    }

    const pending = [...pendingSectionComments.current.values()];
    pendingSectionComments.current.clear();

    for (const item of pending) {
      void setWebsiteShareSectionComment({
        token,
        pageId: item.pageId,
        sectionId: item.sectionId,
        comment: item.comment,
      }).catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not save section comment',
        );
      });
    }
  }, []);

  useEffect(() => {
    if (openWireframePageId !== null) return;
    flushPendingSectionComments();
  }, [openWireframePageId, flushPendingSectionComments]);

  useEffect(() => {
    return () => {
      flushPendingSectionComments();
    };
  }, [flushPendingSectionComments]);

  const handleApproval = (
    pageId: string,
    status: 'approved' | 'blocked',
    note?: string,
  ) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? {
              ...page,
              status,
              approvalNote:
                status === 'approved' ? undefined : (note ?? page.approvalNote),
            }
          : page,
      ),
    );
  };

  const handleSectionApproval = (
    pageId: string,
    sectionId: string,
    status: 'approved' | 'blocked',
  ) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? {
              ...page,
              sections: page.sections.map((section) =>
                section.id === sectionId ? { ...section, status } : section,
              ),
            }
          : page,
      ),
    );
  };

  const handleSectionComment = (
    pageId: string,
    sectionId: string,
    comment: string,
  ) => {
    setWireframePagesState((prev) =>
      prev.map((page) =>
        page.pageId !== pageId
          ? page
          : {
              ...page,
              sections: page.sections.map((section) =>
                section.id === sectionId
                  ? { ...section, clientComment: comment }
                  : section,
              ),
            },
      ),
    );

    const token = shareTokenRef.current;
    if (!token) return;

    const key = `${pageId}:${sectionId}`;
    pendingSectionComments.current.set(key, { pageId, sectionId, comment });

    const existing = commentSaveTimers.current.get(key);
    if (existing) clearTimeout(existing);

    commentSaveTimers.current.set(
      key,
      setTimeout(() => {
        pendingSectionComments.current.delete(key);
        commentSaveTimers.current.delete(key);
        void setWebsiteShareSectionComment({
          token,
          pageId,
          sectionId,
          comment,
        }).catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not save section comment',
          );
        });
      }, 700),
    );
  };

  if (scope === 'off' || (pages.length === 0 && !showBrief && !style)) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No planning artefacts are available to view yet.
      </p>
    );
  }

  if (tabs.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No planning artefacts are available to view yet.
      </p>
    );
  }

  const openPage = pages.find((page) => page.id === openWireframePageId);
  const openWireframe = openWireframePageId
    ? wireframeByPage.get(openWireframePageId)
    : null;

  return (
    <div className="w-full space-y-6">
      <div
        role="tablist"
        aria-label="Website planning sections"
        className="flex flex-wrap gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--ozer-accent)] text-white'
                : 'bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)] hover:bg-[color-mix(in_srgb,var(--ozer-accent)_12%,white)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'brief' && brief ? <BriefTab brief={brief} /> : null}

      {activeTab === 'sitemap' ? (
        <HorizontalScroller label="pages">
          {pages.map((page) => {
            const meta = statusMeta(page.status);
            return (
              <article
                key={page.id}
                className={cn(
                  CARD_WIDTH,
                  'flex min-h-[28rem] snap-start flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] bg-white p-5 shadow-[0_10px_30px_rgba(42,23,32,0.06)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-[var(--ozer-plum-900)]">
                      {page.title}
                    </h3>
                    <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                      /{page.slug || '—'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      portalStatusChipClass(page.status),
                    )}
                  >
                    {meta.label}
                  </span>
                </div>

                {page.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ozer-plum-900)]/80">
                    {page.description}
                  </p>
                ) : null}

                {page.sections.length > 0 ? (
                  <ul className="mt-4 flex flex-1 flex-col gap-2">
                    {page.sections.map((section) => {
                      const sectionMeta = sectionTypeMeta(
                        sectionColor(section),
                      );
                      return (
                        <li
                          key={section.id}
                          className={cn(
                            'rounded-xl border px-3 py-2.5',
                            portalSectionChipClass(sectionColor(section)),
                          )}
                        >
                          <p className="text-sm font-semibold">
                            {section.title}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium tracking-wide uppercase opacity-70">
                            {sectionMeta.label}
                          </p>
                          {section.description ? (
                            <p className="mt-1 text-xs leading-relaxed opacity-90">
                              {section.description}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 flex-1 text-sm text-[var(--workspace-shell-text-muted)]">
                    No sections listed yet.
                  </p>
                )}

                {page.approvalNote ? (
                  <p className="mt-3 text-sm text-red-700">
                    Feedback: {page.approvalNote}
                  </p>
                ) : null}

                {resolvedAuth ? (
                  <PageApproval
                    page={page}
                    approvalAuth={resolvedAuth}
                    onUpdated={handleApproval}
                  />
                ) : null}
              </article>
            );
          })}
        </HorizontalScroller>
      ) : null}

      {activeTab === 'wireframes' ? (
        <HorizontalScroller label="wireframes">
          {wireframePages.map((page) => {
            const wireframe = wireframeByPage.get(page.id)!;
            const firstSection = wireframe.sections[0]!;

            return (
              <button
                key={`wire-card-${page.id}`}
                type="button"
                onClick={() => setOpenWireframePageId(page.id)}
                className={cn(
                  CARD_WIDTH,
                  'flex min-h-[28rem] snap-start flex-col overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-white text-left shadow-[0_10px_30px_rgba(42,23,32,0.06)] transition hover:border-[var(--ozer-accent)]/40',
                )}
              >
                <div className="space-y-2 p-5 pb-3">
                  <h3 className="text-lg font-semibold text-[var(--ozer-plum-900)]">
                    {page.title}
                  </h3>
                  <p className="line-clamp-3 text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
                    {page.description ||
                      `${wireframe.sections.length} section${wireframe.sections.length === 1 ? '' : 's'} to review`}
                  </p>
                </div>
                <div className="relative mx-5 mb-5 flex-1 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)]">
                  <div className="pointer-events-none origin-top scale-[0.42] p-2">
                    <WireframePreview section={firstSection} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/80 to-transparent p-3 pt-10 text-center text-xs font-medium text-[var(--ozer-plum-900)]">
                    Open full wireframe
                  </div>
                </div>
              </button>
            );
          })}
        </HorizontalScroller>
      ) : null}

      {activeTab === 'design' && style ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['Primary', style.tokens.colors.primary],
                ['Secondary', style.tokens.colors.secondary],
                ['Accent', style.tokens.colors.accent],
                [
                  'Ink',
                  style.tokens.colors.neutrals[
                    style.tokens.colors.neutrals.length - 1
                  ] ?? '#111',
                ],
              ] as const
            ).map(([label, color]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white p-4"
              >
                <span
                  className="h-12 w-12 shrink-0 rounded-lg border border-[color:var(--workspace-shell-border)]"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {label}
                  </p>
                  <p className="font-mono text-sm text-[var(--ozer-plum-900)]">
                    {color}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {style.tokens.typography.displayFamily ||
          style.tokens.typography.bodyFamily ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Type: {style.tokens.typography.displayFamily || '—'} /{' '}
              {style.tokens.typography.bodyFamily || '—'}
            </p>
          ) : null}
        </div>
      ) : null}

      {openPage && openWireframe ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--ozer-cream-50)]">
          <div className="flex items-center justify-between gap-4 border-b border-[color:var(--workspace-shell-border)] bg-white px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                {websiteName ?? 'Wireframe'}
              </p>
              <h2 className="truncate text-lg font-semibold text-[var(--ozer-plum-900)]">
                {openPage.title}
              </h2>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => setOpenWireframePageId(null)}
              aria-label="Close wireframe"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <WireframePageViewer
            fullViewport
            className="min-h-0 flex-1"
            pageTitle={openPage.title}
            clientFeedbackMode
            canEditClientComments={canEditClientComments}
            onClientCommentChange={(sectionId, comment) =>
              handleSectionComment(openPage.id, sectionId, comment)
            }
            sections={openWireframe.sections.map((section) => ({
              id: section.id,
              title: section.title,
              clientComment: section.clientComment,
            }))}
            renderSection={(sectionId) => {
              const section = openWireframe.sections.find(
                (item) => item.id === sectionId,
              );
              if (!section) return null;
              return <WireframePreview section={section} />;
            }}
            renderSectionControls={
              resolvedAuth
                ? (sectionId) => {
                    const sitemapSection = openPage.sections.find(
                      (section) => section.id === sectionId,
                    );
                    const wireSection = openWireframe.sections.find(
                      (section) => section.id === sectionId,
                    );
                    return (
                      <SectionApproval
                        pageId={openPage.id}
                        sectionId={sectionId}
                        sectionTitle={
                          sitemapSection?.title ??
                          wireSection?.title ??
                          'Section'
                        }
                        status={sitemapSection?.status}
                        approvalAuth={resolvedAuth}
                        onUpdated={handleSectionApproval}
                      />
                    );
                  }
                : undefined
            }
            sidebarFooter={
              resolvedAuth ? (
                <PageApproval
                  compact
                  page={openPage}
                  approvalAuth={resolvedAuth}
                  onUpdated={(pageId, status, note) => {
                    handleApproval(pageId, status, note);
                    if (status === 'approved') {
                      setOpenWireframePageId(null);
                    }
                  }}
                />
              ) : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}
