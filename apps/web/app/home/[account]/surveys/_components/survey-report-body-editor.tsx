'use client';

import { type ReactNode, useEffect, useState } from 'react';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  GripVertical,
  Heading2,
  ImageIcon,
  Minus,
  Trash2,
  Type,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  getWorkspaceDocDownloadUrlAction,
  listProposalDocsAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import {
  SURVEY_REPORT_BLOCK_LIBRARY,
  type SurveyReportBlock,
  type SurveyReportDocument,
  createSurveyReportBlock,
  duplicateSurveyReportBlock,
  insertSurveyReportBlock,
  moveSurveyReportBlock,
  removeSurveyReportBlock,
  reorderSurveyReportBlocks,
} from '~/lib/building-surveyor/survey-report-document';
import { sanitizeSurveyReportHtml } from '~/lib/building-surveyor/compile-survey-report-document';
import { RICH_TEXT_LIST_CLASS } from '~/lib/rich-text-html';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { SurveyReportBlockInspector } from './survey-report-block-inspector';
import { SurveySectionHeadingIcon } from './survey-section-heading-icon';

const BLOCK_ICONS = {
  heading: Heading2,
  text: Type,
  image: ImageIcon,
  divider: Minus,
} as const;

type CuratedPhoto = {
  id: string;
  title: string;
  caption?: string | null;
  pinnedSectionKey?: string | null;
  previewUrl?: string;
};

export function SurveyReportBodyEditor({
  document,
  accountId,
  proposalId,
  disabled,
  onChange,
}: {
  document: SurveyReportDocument;
  accountId: string;
  proposalId: string;
  disabled?: boolean;
  onChange: (document: SurveyReportDocument) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    document.blocks[0]?.id ?? null,
  );
  const [photos, setPhotos] = useState<CuratedPhoto[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const selected = document.blocks.find((block) => block.id === selectedId);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await listProposalDocsAction({ accountId, proposalId });
      const items = (result.items ?? []).filter(
        (item) => item.photoRole === 'curated' || item.pinnedSectionKey,
      );
      const withUrls: CuratedPhoto[] = [];
      const urlMap: Record<string, string> = {};

      await Promise.all(
        items.map(async (item) => {
          const signed = await getWorkspaceDocDownloadUrlAction({
            accountId,
            docId: item.id,
          });
          if (signed.url) urlMap[item.id] = signed.url;
          withUrls.push({
            id: item.id,
            title: item.title,
            caption: item.caption,
            pinnedSectionKey: item.pinnedSectionKey,
            previewUrl: signed.url ?? undefined,
          });
        }),
      );

      if (cancelled) return;
      setPhotos(withUrls);
      setPreviewUrls(urlMap);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, proposalId]);

  function commit(next: SurveyReportDocument) {
    onChange(next);
  }

  function addBlock(type: SurveyReportBlock['type']) {
    if (disabled) return;
    const block = createSurveyReportBlock(type);
    const next = insertSurveyReportBlock(document, block, selectedId);
    commit(next);
    setSelectedId(block.id);
  }

  return (
    <div className="space-y-3">
      <p className={`text-sm ${workspaceTextMuted}`}>
        Build the report from stacked text and image blocks. AI draft fills
        these sections and places curated photos with captions.
      </p>

      <div className="grid gap-3 xl:grid-cols-[150px_minmax(0,1fr)_260px]">
        <aside className={`${workspacePanelCard} p-2`}>
          <p className={`mb-2 px-1 text-xs font-medium ${workspaceTextMuted}`}>
            Blocks
          </p>
          <div className="grid grid-cols-2 gap-1 xl:grid-cols-1">
            {SURVEY_REPORT_BLOCK_LIBRARY.map((item) => {
              const Icon = BLOCK_ICONS[item.type];
              return (
                <button
                  key={item.type}
                  type="button"
                  disabled={disabled}
                  onClick={() => addBlock(item.type)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                    workspaceText,
                    'hover:bg-[var(--workspace-shell-panel-hover)] disabled:opacity-50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="overflow-auto rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-6">
          <div className="mx-auto max-w-[680px] overflow-hidden bg-white text-[var(--ozer-text-on-light)] shadow-sm">
            {document.blocks.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[var(--ozer-text-muted)]">
                Add a heading or generate a draft to start the report.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  if (disabled) return;
                  const overId = event.over?.id;
                  if (!overId || event.active.id === overId) return;
                  commit(
                    reorderSurveyReportBlocks(
                      document,
                      String(event.active.id),
                      String(overId),
                    ),
                  );
                }}
              >
                <SortableContext
                  items={document.blocks.map((block) => block.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {document.blocks.map((block, index) => (
                    <SortableCanvasBlock
                      key={block.id}
                      block={
                        block.type === 'image' &&
                        block.documentId &&
                        previewUrls[block.documentId]
                          ? {
                              ...block,
                              src: previewUrls[block.documentId] ?? block.src,
                            }
                          : block
                      }
                      selected={block.id === selectedId}
                      disabled={disabled}
                      canMoveUp={index > 0}
                      canMoveDown={index < document.blocks.length - 1}
                      onSelect={() => setSelectedId(block.id)}
                      onMove={(direction) =>
                        commit(
                          moveSurveyReportBlock(document, block.id, direction),
                        )
                      }
                      onDuplicate={() => {
                        const next = duplicateSurveyReportBlock(
                          document,
                          block.id,
                        );
                        commit(next);
                        const clone = next.blocks[index + 1];
                        if (clone) setSelectedId(clone.id);
                      }}
                      onDelete={() => {
                        const next = removeSurveyReportBlock(
                          document,
                          block.id,
                        );
                        commit(next);
                        setSelectedId(
                          next.blocks[Math.max(0, index - 1)]?.id ?? null,
                        );
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <aside className={`${workspacePanelCard} space-y-3 p-4`}>
          <SurveyReportBlockInspector
            block={selected ?? null}
            accountId={accountId}
            photos={photos}
            disabled={disabled}
            onChange={(patch) => {
              if (!selected) return;
              commit({
                ...document,
                blocks: document.blocks.map((block) =>
                  block.id === selected.id
                    ? ({
                        ...block,
                        ...patch,
                        type: block.type,
                      } as SurveyReportBlock)
                    : block,
                ),
              });
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function SortableCanvasBlock({
  block,
  selected,
  disabled,
  canMoveUp,
  canMoveDown,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: SurveyReportBlock;
  selected: boolean;
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'relative border-2',
        selected
          ? 'border-[var(--ozer-accent)]'
          : 'border-transparent hover:border-[color:var(--workspace-shell-border)]',
        isDragging ? 'z-10 opacity-70' : '',
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`Select ${block.type} block`}
        onClick={onSelect}
      />
      {selected ? (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0.5">
          <button
            type="button"
            className="cursor-grab p-1 text-[var(--workspace-shell-text-muted)]"
            disabled={disabled}
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <IconAction
            label="Move up"
            disabled={disabled || !canMoveUp}
            onClick={() => onMove(-1)}
          >
            ↑
          </IconAction>
          <IconAction
            label="Move down"
            disabled={disabled || !canMoveDown}
            onClick={() => onMove(1)}
          >
            ↓
          </IconAction>
          <IconAction
            label="Duplicate"
            disabled={disabled}
            onClick={onDuplicate}
          >
            <Copy className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label="Delete" disabled={disabled} onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconAction>
        </div>
      ) : null}
      <CanvasBlockPreview block={block} />
    </div>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="px-1.5 py-1 text-xs text-[var(--workspace-shell-text)] disabled:opacity-40"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CanvasBlockPreview({ block }: { block: SurveyReportBlock }) {
  switch (block.type) {
    case 'heading': {
      return (
        <div className="flex items-center gap-2 px-6 py-3">
          <SurveySectionHeadingIcon
            sectionKey={block.sectionKey}
            className="h-4 w-4 shrink-0 text-[var(--ozer-text-muted)]"
          />
          {block.level === 1 ? (
            <h1 className="text-2xl font-semibold">
              {block.text || 'Heading'}
            </h1>
          ) : (
            <h2 className="text-lg font-semibold">{block.text || 'Heading'}</h2>
          )}
        </div>
      );
    }
    case 'text':
      return (
        <div
          className={`px-6 py-3 text-sm leading-relaxed ${RICH_TEXT_LIST_CLASS}`}
          dangerouslySetInnerHTML={{
            __html: sanitizeSurveyReportHtml(block.html || '<p></p>'),
          }}
        />
      );
    case 'image':
      return (
        <figure className="px-6 py-3">
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt || block.caption || ''}
              className="max-h-72 w-full rounded-md object-contain"
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-[color:var(--ozer-border-on-light)] text-sm text-[var(--ozer-text-muted)]">
              Choose a curated photo
            </div>
          )}
          {block.caption ? (
            <figcaption className="mt-2 text-xs text-[var(--ozer-text-muted)]">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'divider':
      return (
        <div className="px-6 py-3">
          <hr className="border-[color:var(--ozer-border-on-light)]" />
        </div>
      );
  }
}
