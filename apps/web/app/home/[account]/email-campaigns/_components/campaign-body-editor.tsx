'use client';

import { type ReactNode, useState } from 'react';

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
  Columns2,
  Copy,
  GripVertical,
  Heading2,
  ImageIcon,
  Minus,
  Monitor,
  MousePointerClick,
  PanelBottom,
  Smartphone,
  Trash2,
  Type,
  UnfoldVertical,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type {
  CampaignBlock,
  CampaignBrand,
  CampaignColumnContent,
  CampaignDocument,
} from '~/lib/campaigns/campaign-document';
import {
  CAMPAIGN_BLOCK_LIBRARY,
  createCampaignBlock,
  duplicateCampaignBlock,
  insertCampaignBlock,
  isSafeHttpUrl,
  moveCampaignBlock,
  removeCampaignBlock,
  reorderCampaignBlocks,
  updateCampaignBlock,
} from '~/lib/campaigns/campaign-document';
import { sanitizeRichText } from '~/lib/campaigns/compile-campaign-document';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignBlockInspector } from './campaign-block-inspector';

const BLOCK_ICONS: Record<string, typeof Type> = {
  logo: ImageIcon,
  heading: Heading2,
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  divider: Minus,
  spacer: UnfoldVertical,
  columns: Columns2,
  footer: PanelBottom,
};

export function CampaignBodyEditor({
  document,
  brand,
  disabled,
  onChange,
  previewWidth,
  onPreviewWidthChange,
}: {
  document: CampaignDocument;
  brand: CampaignBrand;
  disabled?: boolean;
  onChange: (document: CampaignDocument) => void;
  previewWidth: 'desktop' | 'mobile';
  onPreviewWidthChange: (width: 'desktop' | 'mobile') => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    document.blocks[0]?.id ?? null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const selected = document.blocks.find((block) => block.id === selectedId);

  function commit(next: CampaignDocument) {
    onChange(next);
  }

  function addBlock(type: CampaignBlock['type']) {
    if (disabled) return;
    const block = createCampaignBlock(type);
    const next = insertCampaignBlock(document, block, selectedId);
    commit(next);
    setSelectedId(block.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm ${workspaceTextMuted}`}>
          Build the email from stacked blocks. Brand logo and colours come from
          workspace Brand settings.
        </p>
        <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] p-0.5">
          <Button
            type="button"
            size="sm"
            variant={previewWidth === 'desktop' ? 'secondary' : 'ghost'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => onPreviewWidthChange('desktop')}
            data-test="campaign-preview-desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={previewWidth === 'mobile' ? 'secondary' : 'ghost'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => onPreviewWidthChange('mobile')}
            data-test="campaign-preview-mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[160px_minmax(0,1fr)_280px]">
        <aside
          className={`${workspacePanelCard} p-2`}
          data-test="campaign-block-palette"
        >
          <p className={`mb-2 px-1 text-xs font-medium ${workspaceTextMuted}`}>
            Blocks
          </p>
          <div className="grid grid-cols-2 gap-1 xl:grid-cols-1">
            {CAMPAIGN_BLOCK_LIBRARY.map((item) => {
              const Icon = BLOCK_ICONS[item.type] ?? Type;
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

        <div
          className="overflow-auto rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-6"
          data-test="campaign-block-canvas"
        >
          <div
            className="mx-auto overflow-hidden bg-white shadow-sm transition-[width] duration-200"
            style={{
              width: previewWidth === 'mobile' ? 375 : 600,
              maxWidth: '100%',
            }}
          >
            {document.blocks.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#6b5c63]">
                Add a block from the palette to start the email.
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
                    reorderCampaignBlocks(
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
                      block={block}
                      brand={brand}
                      selected={block.id === selectedId}
                      disabled={disabled}
                      canMoveUp={index > 0}
                      canMoveDown={index < document.blocks.length - 1}
                      onSelect={() => setSelectedId(block.id)}
                      onMove={(direction) =>
                        commit(moveCampaignBlock(document, block.id, direction))
                      }
                      onDuplicate={() => {
                        const next = duplicateCampaignBlock(document, block.id);
                        commit(next);
                        const clone = next.blocks[index + 1];
                        if (clone) setSelectedId(clone.id);
                      }}
                      onDelete={() => {
                        const next = removeCampaignBlock(document, block.id);
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

        <aside
          className={`${workspacePanelCard} space-y-3 p-4`}
          data-test="campaign-block-inspector"
        >
          <CampaignBlockInspector
            block={selected ?? null}
            disabled={disabled}
            onChange={(patch) => {
              if (!selected) return;
              commit(updateCampaignBlock(document, selected.id, patch));
            }}
            onInsertMerge={(token) => {
              if (!selected) return;
              if (selected.type === 'heading') {
                commit(
                  updateCampaignBlock(document, selected.id, {
                    text: `${selected.text}${token}`,
                  }),
                );
                return;
              }
              if (selected.type === 'button') {
                commit(
                  updateCampaignBlock(document, selected.id, {
                    label: `${selected.label}${token}`,
                  }),
                );
              }
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function SortableCanvasBlock({
  block,
  brand,
  selected,
  disabled,
  canMoveUp,
  canMoveDown,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  block: CampaignBlock;
  brand: CampaignBrand;
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
      <CanvasBlockPreview block={block} brand={brand} />
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

function CanvasBlockPreview({
  block,
  brand,
}: {
  block: CampaignBlock;
  brand: CampaignBrand;
}) {
  const primary = brand.primary_color || '#0D2344';
  const accent = brand.accent_color || '#57C87F';

  switch (block.type) {
    case 'logo':
      return (
        <div
          className="px-7 py-5"
          style={{ background: primary, textAlign: block.align ?? 'left' }}
        >
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo_url}
              alt=""
              className="inline-block h-10 w-auto"
            />
          ) : (
            <span className="text-sm text-white">Workspace logo</span>
          )}
        </div>
      );
    case 'heading':
      return (
        <div
          className="px-7 py-3 font-semibold text-[#09111F]"
          style={{
            textAlign: block.align ?? 'left',
            fontSize: block.level === 1 ? 28 : 22,
          }}
        >
          {block.text || 'Heading'}
        </div>
      );
    case 'text':
      return (
        <div
          className="px-7 py-3 text-[16px] leading-relaxed text-[#09111F]"
          style={{ textAlign: block.align ?? 'left' }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.html) }}
        />
      );
    case 'image':
      return block.src && isSafeHttpUrl(block.src) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.src} alt={block.alt} className="w-full px-7 py-3" />
      ) : (
        <div className="px-7 py-8 text-center text-sm text-[#6b5c63]">
          Add an image URL in the inspector
        </div>
      );
    case 'button':
      return (
        <div
          className="px-7 py-3"
          style={{ textAlign: block.align ?? 'center' }}
        >
          <span
            className="inline-block rounded-md px-6 py-3 text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            {block.label || 'Button'}
          </span>
        </div>
      );
    case 'divider':
      return (
        <div className="px-7 py-3">
          <div className="border-t border-[#e4ddd6]" />
        </div>
      );
    case 'spacer':
      return <div style={{ height: block.height }} />;
    case 'columns':
      return (
        <div className="grid grid-cols-2 gap-4 px-7 py-3 text-[15px] text-[#09111F]">
          <ColumnPreview content={block.left} />
          <ColumnPreview content={block.right} />
        </div>
      );
    case 'footer':
      return (
        <div className="px-7 py-3 text-xs leading-5 text-[#6b5c63]">
          {block.text}
          <div className="mt-1 underline">Unsubscribe</div>
        </div>
      );
    case 'html':
      return (
        <div
          className="px-7 py-3 text-[16px] leading-relaxed text-[#09111F]"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.html) }}
        />
      );
  }
}

function ColumnPreview({ content }: { content: CampaignColumnContent }) {
  if (content.kind === 'image') {
    return content.src && isSafeHttpUrl(content.src) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={content.src} alt={content.alt} className="w-full" />
    ) : (
      <p className="text-sm text-[#6b5c63]">Image</p>
    );
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(content.html) }} />
  );
}
