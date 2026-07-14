'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Component,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  PAGE_TYPE_OPTIONS,
  PLANNING_STATUS_OPTIONS,
  SECTION_TYPE_OPTIONS,
  createPlanningId,
  planningStatusMeta,
  sectionColor,
  sectionTypeMeta,
  slugifyPageTitle,
  type WebsitePageType,
  type WebsitePlanningStatus,
  type WebsiteSectionType,
  WEBSITE_SITEMAP_SCHEMA_VERSION,
  type WebsiteSitemapDocument,
  type WebsiteSitemapPage,
  type WebsiteSitemapSection,
  type WebsiteSitemapSymbol,
} from '~/lib/websites/planning-types';
import {
  SITE_STUDIO_AI_CREDITS,
  siteStudioCreditLabel,
} from '~/lib/websites/site-studio-credits';
import type {
  SitemapProposeMode,
  SitemapProposal,
} from '~/lib/websites/site-studio-ai-types';
import {
  DEFAULT_SITEMAP_SYMBOLS,
  applySymbolToPages,
  migrateSitemapDocument,
} from '~/lib/websites/sitemap-document';

import { saveWebsiteSitemap } from '../../_lib/server/planning-actions';
import { proposeWebsiteSitemap } from '../../_lib/server/site-studio-actions';
import {
  SitemapAiPreview,
  SitemapAiUndoBar,
} from './sitemap-ai-preview';

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

type PageNodeData = {
  page: WebsiteSitemapPage;
  selectedSectionId: string | null;
  onSelectSection: (pageId: string, sectionId: string) => void;
};

type Selection =
  | { kind: 'page'; pageId: string }
  | { kind: 'section'; pageId: string; sectionId: string }
  | null;

function StatusPip({ status }: { status?: WebsitePlanningStatus }) {
  const meta = planningStatusMeta(status ?? 'draft');
  const pipClass =
    status === 'approved'
      ? 'bg-emerald-400'
      : status === 'blocked'
        ? 'bg-red-400'
        : 'bg-[var(--workspace-shell-text-muted)]';
  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 rounded-full', pipClass)}
      title={meta.label}
    />
  );
}

function SitemapPageNode({ data }: NodeProps<Node<PageNodeData>>) {
  const { page, selectedSectionId, onSelectSection } = data;

  return (
    <div className="w-[260px] rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] shadow-sm">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !bg-[var(--ozer-accent)]"
      />
      <div className="border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
            {page.title || 'Untitled'}
          </p>
          <StatusPip status={page.status} />
        </div>
        <p className="truncate font-mono text-[10px] text-[var(--workspace-shell-text-muted)]">
          /{page.slug}
        </p>
      </div>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto p-2">
        {page.sections.length === 0 ? (
          <li className="px-1 py-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
            No sections
          </li>
        ) : (
          page.sections.map((section) => {
            const color = sectionColor(section);
            const meta = sectionTypeMeta(color);
            const isSymbol = Boolean(section.componentKey);
            const selected = selectedSectionId === section.id;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onSelectSection(page.id, section.id)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px]',
                    meta.colorClass,
                    selected
                      ? 'ring-1 ring-[var(--ozer-accent)]'
                      : '',
                    isSymbol && 'outline outline-1 outline-[var(--ozer-accent)]/40',
                  )}
                >
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', meta.dotClass)}
                  />
                  <span className="min-w-0 flex-1 truncate text-[var(--workspace-shell-text)]">
                    {section.title || 'Untitled'}
                  </span>
                  {isSymbol ? (
                    <Component className="h-3 w-3 shrink-0 text-[var(--ozer-accent)]" />
                  ) : null}
                  <StatusPip status={section.status} />
                </button>
              </li>
            );
          })
        )}
      </ul>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !bg-[var(--ozer-accent)]"
      />
    </div>
  );
}

const nodeTypes = { sitemapPage: SitemapPageNode };

function pagesToFlow(
  pages: WebsiteSitemapPage[],
  selectedSectionId: string | null,
  onSelectSection: (pageId: string, sectionId: string) => void,
): { nodes: Node<PageNodeData>[]; edges: Edge[] } {
  const nodes: Node<PageNodeData>[] = pages.map((page) => ({
    id: page.id,
    type: 'sitemapPage',
    position: { x: page.x ?? 0, y: page.y ?? 0 },
    data: { page, selectedSectionId, onSelectSection },
  }));

  const pageIds = new Set(pages.map((page) => page.id));
  const edges: Edge[] = pages
    .filter(
      (page) => page.parentId && pageIds.has(page.parentId) && page.parentId !== page.id,
    )
    .map((page) => ({
      id: `e-${page.parentId}-${page.id}`,
      source: page.parentId as string,
      target: page.id,
      animated: false,
      style: { stroke: 'var(--ozer-accent)' },
    }));

  return { nodes, edges };
}

export function WebsiteSitemapCanvas({
  accountId,
  websiteId,
  initialSitemap,
  initialComponents = [],
  onSitemapChange,
  canEdit,
  siteStudioEnabled: _siteStudioEnabled,
}: {
  accountId: string;
  websiteId: string;
  initialSitemap: WebsiteSitemapPage[];
  initialComponents?: WebsiteSitemapSymbol[];
  onSitemapChange?: (sitemap: WebsiteSitemapPage[]) => void;
  canEdit: boolean;
  siteStudioEnabled: boolean;
}) {
  const seed = useMemo(
    () =>
      migrateSitemapDocument({
        schemaVersion: WEBSITE_SITEMAP_SCHEMA_VERSION,
        pages: initialSitemap,
        components: initialComponents,
      }),
    [initialComponents, initialSitemap],
  );

  const [pages, setPages] = useState(seed.pages);
  const [components, setComponents] = useState(() =>
    seed.components.length > 0 ? seed.components : DEFAULT_SITEMAP_SYMBOLS,
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [symbolsOpen, setSymbolsOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isGenerating, startGenerating] = useTransition();
  const [, startTransition] = useTransition();
  const [proposal, setProposal] = useState<SitemapProposal | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    pages: WebsiteSitemapPage[];
    components: WebsiteSitemapSymbol[];
  } | null>(null);
  const skipNextSave = useRef(true);
  const onSitemapChangeRef = useRef(onSitemapChange);
  onSitemapChangeRef.current = onSitemapChange;

  const selectedSectionId =
    selection?.kind === 'section' ? selection.sectionId : null;

  const onSelectSection = useCallback((pageId: string, sectionId: string) => {
    setSelection({ kind: 'section', pageId, sectionId });
    setInspectorOpen(true);
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => pagesToFlow(pages, selectedSectionId, onSelectSection),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once; sync below
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const next = migrateSitemapDocument({
      schemaVersion: WEBSITE_SITEMAP_SCHEMA_VERSION,
      pages: initialSitemap,
      components: initialComponents,
    });
    skipNextSave.current = true;
    setPages(next.pages);
    setComponents(
      next.components.length > 0 ? next.components : DEFAULT_SITEMAP_SYMBOLS,
    );
  }, [initialComponents, initialSitemap]);

  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = pagesToFlow(
      pages,
      selectedSectionId,
      onSelectSection,
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [onSelectSection, pages, selectedSectionId, setEdges, setNodes]);

  function commitDocument(
    nextPages: WebsiteSitemapPage[],
    nextComponents: WebsiteSitemapSymbol[] = components,
  ) {
    setPages(nextPages);
    setComponents(nextComponents);
    queueMicrotask(() => onSitemapChangeRef.current?.(nextPages));
  }

  useEffect(() => {
    if (!canEdit) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState('saving');
    const document: WebsiteSitemapDocument = {
      schemaVersion: WEBSITE_SITEMAP_SCHEMA_VERSION,
      pages,
      components,
    };
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveWebsiteSitemap({
            accountId,
            websiteId,
            sitemap: document,
          });
          setSaveState('saved');
        } catch (error) {
          setSaveState('idle');
          toast.error(
            error instanceof Error ? error.message : 'Could not save sitemap',
          );
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [accountId, canEdit, components, pages, websiteId, startTransition]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!canEdit) return;
      commitDocument(
        pages.map((page) =>
          page.id === node.id
            ? { ...page, x: node.position.x, y: node.position.y }
            : page,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, pages],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      setEdges((eds) => addEdge(connection, eds));
      commitDocument(
        pages.map((page) =>
          page.id === connection.target
            ? { ...page, parentId: connection.source }
            : page,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, pages, setEdges],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!canEdit) return;
      const cleared = new Set(deleted.map((edge) => edge.target));
      commitDocument(
        pages.map((page) =>
          cleared.has(page.id) ? { ...page, parentId: null } : page,
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, pages],
  );

  function addPage() {
    const title = 'New page';
    const id = createPlanningId();
    const offset = pages.length;
    commitDocument([
      ...pages,
      {
        id,
        title,
        slug: slugifyPageTitle(title),
        sections: [],
        description: '',
        pageType: 'other',
        status: 'draft',
        parentId: null,
        x: 80 + (offset % 4) * 320,
        y: 80 + Math.floor(offset / 4) * 280,
        seoIntent: '',
      },
    ]);
    setSelection({ kind: 'page', pageId: id });
  }

  function updatePage(pageId: string, patch: Partial<WebsiteSitemapPage>) {
    commitDocument(
      pages.map((page) => {
        if (page.id !== pageId) return page;
        const next = { ...page, ...patch };
        if (patch.title !== undefined) {
          next.slug = slugifyPageTitle(patch.title) || page.slug;
        }
        return next;
      }),
    );
  }

  function removePage(pageId: string) {
    commitDocument(
      pages
        .filter((page) => page.id !== pageId)
        .map((page) =>
          page.parentId === pageId ? { ...page, parentId: null } : page,
        ),
    );
    setSelection(null);
  }

  function updateSection(
    pageId: string,
    sectionId: string,
    patch: Partial<WebsiteSitemapSection>,
  ) {
    const color =
      patch.color ??
      (patch.sectionType !== undefined ? patch.sectionType : undefined);
    const normalizedPatch =
      color !== undefined
        ? { ...patch, color, sectionType: color }
        : patch;

    const source = pages
      .find((page) => page.id === pageId)
      ?.sections.find((section) => section.id === sectionId);
    const sharedKey = source?.componentKey ?? null;
    const propagate =
      sharedKey &&
      (normalizedPatch.title !== undefined ||
        normalizedPatch.description !== undefined ||
        normalizedPatch.color !== undefined ||
        normalizedPatch.status !== undefined);

    let nextComponents = components;
    if (sharedKey && propagate) {
      nextComponents = components.map((symbol) =>
        symbol.key === sharedKey
          ? {
              ...symbol,
              title: normalizedPatch.title ?? symbol.title,
              description: normalizedPatch.description ?? symbol.description,
              color: normalizedPatch.color ?? symbol.color,
              status: normalizedPatch.status ?? symbol.status,
            }
          : symbol,
      );
    }

    commitDocument(
      pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (page.id === pageId && section.id === sectionId) {
            return { ...section, ...normalizedPatch };
          }
          if (propagate && section.componentKey === sharedKey) {
            const { componentKey: _k, ...content } = normalizedPatch;
            return { ...section, ...content };
          }
          return section;
        }),
      })),
      nextComponents,
    );
  }

  function addSection(pageId: string) {
    const sectionId = createPlanningId();
    commitDocument(
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              sections: [
                ...page.sections,
                {
                  id: sectionId,
                  title: 'New section',
                  description: '',
                  color: 'content' as WebsiteSectionType,
                  sectionType: 'content' as WebsiteSectionType,
                  componentKey: null,
                  status: 'draft' as WebsitePlanningStatus,
                },
              ],
            },
      ),
    );
    setSelection({ kind: 'section', pageId, sectionId });
  }

  function removeSection(pageId: string, sectionId: string) {
    commitDocument(
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              sections: page.sections.filter(
                (section) => section.id !== sectionId,
              ),
            },
      ),
    );
    setSelection({ kind: 'page', pageId });
  }

  function upsertSymbol(symbol: WebsiteSitemapSymbol) {
    const exists = components.some((item) => item.key === symbol.key);
    const nextComponents = exists
      ? components.map((item) => (item.key === symbol.key ? symbol : item))
      : [...components, symbol];
    commitDocument(applySymbolToPages(pages, symbol), nextComponents);
  }

  function applySymbolToPage(pageId: string, symbol: WebsiteSitemapSymbol) {
    const sectionId = createPlanningId();
    const nextComponents = components.some((item) => item.key === symbol.key)
      ? components
      : [...components, symbol];
    commitDocument(
      pages.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              sections: [
                ...page.sections,
                {
                  id: sectionId,
                  title: symbol.title,
                  description: symbol.description,
                  color: symbol.color,
                  sectionType: symbol.color,
                  componentKey: symbol.key,
                  status: symbol.status,
                },
              ],
            },
      ),
      nextComponents,
    );
  }

  function propose(mode: SitemapProposeMode) {
    startGenerating(async () => {
      try {
        const next = await proposeWebsiteSitemap({
          accountId,
          websiteId,
          mode,
        });
        setProposal(next);
        toast.success(
          `Preview ready — ${next.pages.length} page${next.pages.length === 1 ? '' : 's'} (${siteStudioCreditLabel(next.creditsUsed)})`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not generate sitemap',
        );
      }
    });
  }

  function applyProposal() {
    if (!proposal) return;
    setUndoSnapshot({ pages, components });
    if (proposal.mode === 'from-brief') {
      commitDocument(proposal.pages, components);
    } else {
      const existingSlugs = new Set(pages.map((page) => page.slug));
      const additions = proposal.pages.filter(
        (page) => !existingSlugs.has(page.slug),
      );
      commitDocument([...pages, ...additions], components);
    }
    setProposal(null);
    toast.success('Sitemap proposal applied');
  }

  function undoLastApply() {
    if (!undoSnapshot) return;
    commitDocument(undoSnapshot.pages, undoSnapshot.components);
    setUndoSnapshot(null);
    toast.success('Sitemap restored');
  }

  const selectedPage =
    selection == null
      ? null
      : (pages.find((page) => page.id === selection.pageId) ?? null);
  const selectedSection =
    selection?.kind === 'section' && selectedPage
      ? (selectedPage.sections.find(
          (section) => section.id === selection.sectionId,
        ) ?? null)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Drag pages to layout, connect to nest. Symbols keep shared sections
            in sync.
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved'
                : `${pages.length} pages · ${components.length} symbols`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit || isGenerating}
            onClick={() => propose('from-brief')}
            title={siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.sitemapGenerate)}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {isGenerating
              ? 'Suggesting…'
              : `Suggest from brief (${siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.sitemapGenerate)})`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit || isGenerating}
            onClick={() => propose('add-missing-seo-pages')}
            title={siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.sitemapGenerate)}
          >
            Add SEO pages ({siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.sitemapGenerate)})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit || isGenerating}
            onClick={() => propose('local-service-variants')}
            title={siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.sitemapGenerate)}
          >
            Local/service variants ({siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.sitemapGenerate)})
          </Button>
          {undoSnapshot ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!canEdit}
              onClick={undoLastApply}
            >
              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
              Undo AI
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSymbolsOpen((value) => !value)}
          >
            <Component className="mr-1.5 h-3.5 w-3.5" />
            Symbols
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setInspectorOpen((value) => !value)}
          >
            {inspectorOpen ? (
              <PanelRightClose className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="mr-1.5 h-3.5 w-3.5" />
            )}
            Inspector
          </Button>
          {canEdit ? (
            <Button type="button" size="sm" onClick={addPage}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add page
            </Button>
          ) : null}
        </div>
      </div>

      {proposal ? (
        <SitemapAiPreview
          mode={proposal.mode}
          pages={proposal.pages}
          currentPageCount={proposal.currentPageCount}
          skippedExistingSlugs={proposal.skippedExistingSlugs}
          creditsUsed={proposal.creditsUsed}
          busy={isGenerating}
          onApply={applyProposal}
          onDismiss={() => setProposal(null)}
        />
      ) : null}

      {undoSnapshot && !proposal ? (
        <SitemapAiUndoBar onUndo={undoLastApply} disabled={!canEdit} />
      ) : null}

      <div className="flex min-h-[560px] overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
        {symbolsOpen ? (
          <aside className="w-56 shrink-0 space-y-2 border-r border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
            <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Symbols
            </p>
            <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
              Define once, drop onto pages. Instances share edits.
            </p>
            <ul className="space-y-1.5">
              {components.map((symbol) => {
                const meta = sectionTypeMeta(symbol.color);
                return (
                  <li
                    key={symbol.key}
                    className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          meta.dotClass,
                        )}
                      />
                      <span className="truncate text-xs font-medium text-[var(--workspace-shell-text)]">
                        {symbol.title}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--workspace-shell-text-muted)]">
                      {symbol.key}
                    </p>
                    {canEdit && selectedPage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 w-full text-[11px]"
                        onClick={() =>
                          applySymbolToPage(selectedPage.id, symbol)
                        }
                      >
                        Add to page
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const key = `symbol-${createPlanningId().slice(0, 8)}`;
                  upsertSymbol({
                    key,
                    title: 'New symbol',
                    description: '',
                    color: 'content',
                    status: 'draft',
                  });
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New symbol
              </Button>
            ) : null}
          </aside>
        ) : null}

        <div className="relative min-h-[560px] flex-1 bg-[var(--ozer-surface-canvas)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={canEdit ? onNodesChange : undefined}
            onEdgesChange={canEdit ? onEdgesChange : undefined}
            onConnect={canEdit ? onConnect : undefined}
            onEdgesDelete={canEdit ? onEdgesDelete : undefined}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_event, node) => {
              setSelection({ kind: 'page', pageId: node.id });
              setInspectorOpen(true);
            }}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {inspectorOpen ? (
          <aside className="w-72 shrink-0 space-y-3 overflow-y-auto border-l border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
            {!selectedPage ? (
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                Select a page or section to edit.
              </p>
            ) : selectedSection ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Section
                </p>
                <Input
                  value={selectedSection.title}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    updateSection(selectedPage.id, selectedSection.id, {
                      title: event.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="Title"
                />
                <Textarea
                  value={selectedSection.description}
                  readOnly={!canEdit}
                  rows={3}
                  onChange={(event) =>
                    updateSection(selectedPage.id, selectedSection.id, {
                      description: event.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="Short description"
                />
                <Select
                  value={sectionColor(selectedSection)}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updateSection(selectedPage.id, selectedSection.id, {
                      color: value as WebsiteSectionType,
                    })
                  }
                >
                  <SelectTrigger className={cn(inputClass, 'h-9')}>
                    <SelectValue placeholder="Colour tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedSection.status ?? 'draft'}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updateSection(selectedPage.id, selectedSection.id, {
                      status: value as WebsitePlanningStatus,
                    })
                  }
                >
                  <SelectTrigger className={cn(inputClass, 'h-9')}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={selectedSection.componentKey ?? ''}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    updateSection(selectedPage.id, selectedSection.id, {
                      componentKey: event.target.value.trim() || null,
                    })
                  }
                  className={cn(inputClass, 'font-mono text-xs')}
                  placeholder="componentKey (symbol)"
                />
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      removeSection(selectedPage.id, selectedSection.id)
                    }
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove section
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Page
                </p>
                <Input
                  value={selectedPage.title}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    updatePage(selectedPage.id, { title: event.target.value })
                  }
                  className={inputClass}
                  placeholder="Title"
                />
                <Input
                  value={selectedPage.slug}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    updatePage(selectedPage.id, { slug: event.target.value })
                  }
                  className={cn(inputClass, 'font-mono text-xs')}
                  placeholder="slug"
                />
                <Textarea
                  value={selectedPage.description ?? ''}
                  readOnly={!canEdit}
                  rows={3}
                  onChange={(event) =>
                    updatePage(selectedPage.id, {
                      description: event.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="Description"
                />
                <Select
                  value={selectedPage.pageType ?? 'other'}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updatePage(selectedPage.id, {
                      pageType: value as WebsitePageType,
                    })
                  }
                >
                  <SelectTrigger className={cn(inputClass, 'h-9')}>
                    <SelectValue placeholder="Page type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedPage.status ?? 'draft'}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    updatePage(selectedPage.id, {
                      status: value as WebsitePlanningStatus,
                    })
                  }
                >
                  <SelectTrigger className={cn(inputClass, 'h-9')}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={selectedPage.seoIntent ?? ''}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    updatePage(selectedPage.id, {
                      seoIntent: event.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="SEO intent"
                />
                {canEdit ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addSection(selectedPage.id)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add section
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removePage(selectedPage.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete page
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
