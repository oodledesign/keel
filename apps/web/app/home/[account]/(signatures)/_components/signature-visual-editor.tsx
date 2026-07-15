'use client';

import { useMemo } from 'react';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  LayoutTemplate,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  DEFAULT_SIGNATURE_BACKGROUND,
  SIGNATURE_BLOCK_LIBRARY,
  canAddSignatureBlock,
  createMinimalSignatureDocument,
  createSignatureBlock,
  getSignatureBlockDefinition,
  normalizeHexColor,
  resolveSignatureBackground,
  type SignatureBackgroundMode,
  type SignatureBlock,
  type SignatureBlockType,
  type SignatureBuilderDocument,
  type SignatureLayout,
} from '~/lib/signatures/signature-blocks';

function SortableBlockRow({
  block,
  onRemove,
  onTextChange,
}: {
  block: SignatureBlock;
  onRemove: () => void;
  onTextChange: (text: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const definition = getSignatureBlockDefinition(block.type);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2',
        isDragging && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          aria-label={`Reorder ${definition.label}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
            {definition.label}
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {definition.description}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
          onClick={onRemove}
          aria-label={`Remove ${definition.label}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {block.type === 'custom_text' ? (
        <div className="mt-2 pl-6">
          <Label htmlFor={`custom-text-${block.id}`} className="sr-only">
            Custom text
          </Label>
          <Input
            id={`custom-text-${block.id}`}
            value={block.text ?? ''}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Fixed text for this template only"
            className="h-8 text-sm"
          />
        </div>
      ) : null}
      {block.type === 'shared_text' ? (
        <p className="mt-2 pl-6 text-xs text-[var(--workspace-shell-text-muted)]">
          Uses shared snippets from Signatures → Settings (all / department /
          branch).
        </p>
      ) : null}
      {block.type === 'award_badge' ? (
        <p className="mt-2 pl-6 text-xs text-[var(--workspace-shell-text-muted)]">
          Uses matching award badges from Signatures → Settings.
        </p>
      ) : null}
    </div>
  );
}

export function SignatureVisualEditor({
  document,
  onChange,
  onStartVisual,
}: {
  document: SignatureBuilderDocument | null;
  onChange: (next: SignatureBuilderDocument) => void;
  onStartVisual: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const availableBlocks = useMemo(() => {
    if (!document) {
      return SIGNATURE_BLOCK_LIBRARY;
    }

    return SIGNATURE_BLOCK_LIBRARY.filter((item) =>
      canAddSignatureBlock(document.blocks, item.type),
    );
  }, [document]);

  if (!document) {
    return (
      <div className="space-y-4 rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] bg-black/10 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--workspace-shell-text)]">
            <LayoutTemplate className="h-4 w-4 text-[#39AEB3]" />
            <h3 className="text-sm font-medium">Custom HTML template</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            This template was written in HTML, so the visual builder can&apos;t
            edit it safely. Start a visual layout to drag and drop blocks — this
            replaces the current HTML.
          </p>
        </div>
        <Button type="button" onClick={onStartVisual}>
          Start visual layout
        </Button>
      </div>
    );
  }

  const setLayout = (layout: SignatureLayout) => {
    onChange({ ...document, layout });
  };

  const background = resolveSignatureBackground(document.background);

  const setBackgroundMode = (mode: SignatureBackgroundMode) => {
    onChange({
      ...document,
      background: {
        ...background,
        mode,
        color:
          mode === 'none'
            ? background.color
            : normalizeHexColor(background.color, DEFAULT_SIGNATURE_BACKGROUND.color),
        colorEnd: normalizeHexColor(
          background.colorEnd ?? background.color,
          DEFAULT_SIGNATURE_BACKGROUND.colorEnd ?? background.color,
        ),
      },
    });
  };

  const setBackgroundColor = (color: string) => {
    onChange({
      ...document,
      background: {
        ...background,
        color: normalizeHexColor(color, background.color),
      },
    });
  };

  const setBackgroundColorEnd = (colorEnd: string) => {
    onChange({
      ...document,
      background: {
        ...background,
        colorEnd: normalizeHexColor(
          colorEnd,
          background.colorEnd ?? background.color,
        ),
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = document.blocks.findIndex((block) => block.id === active.id);
    const newIndex = document.blocks.findIndex((block) => block.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onChange({
      ...document,
      blocks: arrayMove(document.blocks, oldIndex, newIndex),
    });
  };

  const addBlock = (type: SignatureBlockType) => {
    if (!canAddSignatureBlock(document.blocks, type)) {
      return;
    }

    onChange({
      ...document,
      blocks: [...document.blocks, createSignatureBlock(type)],
    });
  };

  const removeBlock = (id: string) => {
    onChange({
      ...document,
      blocks: document.blocks.filter((block) => block.id !== id),
    });
  };

  const updateBlockText = (id: string, text: string) => {
    onChange({
      ...document,
      blocks: document.blocks.map((block) =>
        block.id === id ? { ...block, text } : block,
      ),
    });
  };

  const resetMinimal = () => {
    onChange(createMinimalSignatureDocument());
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Layout</Label>
        <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-8 px-3',
              document.layout === 'photo_left' &&
                'bg-[var(--workspace-shell-sidebar-accent)]',
            )}
            onClick={() => setLayout('photo_left')}
          >
            Photo left
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-8 px-3',
              document.layout === 'stacked' &&
                'bg-[var(--workspace-shell-sidebar-accent)]',
            )}
            onClick={() => setLayout('stacked')}
          >
            Stacked
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Drag blocks to reorder. Transparent layouts stay dark-mode friendly
          (mid-grey text, underlined links). A filled canvas forces colours so
          light and dark inboxes look the same.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Background</Label>
          <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
            {(
              [
                ['none', 'None'],
                ['solid', 'Colour'],
                ['gradient', 'Gradient'],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 px-3',
                  background.mode === mode &&
                    'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
                onClick={() => setBackgroundMode(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {background.mode !== 'none' ? (
          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sig-bg-color" className="text-xs">
                  {background.mode === 'gradient' ? 'Start colour' : 'Colour'}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="sig-bg-color"
                    type="color"
                    value={normalizeHexColor(
                      background.color,
                      DEFAULT_SIGNATURE_BACKGROUND.color,
                    )}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent p-1"
                  />
                  <Input
                    value={normalizeHexColor(
                      background.color,
                      DEFAULT_SIGNATURE_BACKGROUND.color,
                    )}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    className="h-9 font-mono text-sm uppercase"
                    maxLength={7}
                    spellCheck={false}
                  />
                </div>
              </div>
              {background.mode === 'gradient' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="sig-bg-color-end" className="text-xs">
                    End colour
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="sig-bg-color-end"
                      type="color"
                      value={normalizeHexColor(
                        background.colorEnd ?? background.color,
                        DEFAULT_SIGNATURE_BACKGROUND.colorEnd ??
                          background.color,
                      )}
                      onChange={(event) =>
                        setBackgroundColorEnd(event.target.value)
                      }
                      className="h-9 w-12 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent p-1"
                    />
                    <Input
                      value={normalizeHexColor(
                        background.colorEnd ?? background.color,
                        DEFAULT_SIGNATURE_BACKGROUND.colorEnd ??
                          background.color,
                      )}
                      onChange={(event) =>
                        setBackgroundColorEnd(event.target.value)
                      }
                      className="h-9 font-mono text-sm uppercase"
                      maxLength={7}
                      spellCheck={false}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div
              className="h-10 rounded-lg border border-[color:var(--workspace-shell-border)]"
              style={{
                background:
                  background.mode === 'gradient'
                    ? `linear-gradient(135deg, ${normalizeHexColor(background.color, '#FBF6EC')}, ${normalizeHexColor(background.colorEnd ?? background.color, '#E7DECF')})`
                    : normalizeHexColor(background.color, '#FBF6EC'),
              }}
              aria-hidden
            />
            <p className="text-xs text-muted-foreground">
              Text and link colours are chosen automatically for contrast, and
              marked so clients should not invert them in dark mode. Gradients
              fall back to the start colour in Outlook desktop.
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Blocks</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={resetMinimal}
          >
            Reset to starter
          </Button>
        </div>

        {document.blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-6 text-center text-sm text-muted-foreground">
            No blocks yet — add one below.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={document.blocks.map((block) => block.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {document.blocks.map((block) => (
                  <SortableBlockRow
                    key={block.id}
                    block={block}
                    onRemove={() => removeBlock(block.id)}
                    onTextChange={(text) => updateBlockText(block.id, text)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
        <div>
          <h3 className="text-sm font-medium">Add a block</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Click to append. Most fields can only appear once.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableBlocks.map((item) => (
            <Button
              key={item.type}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => addBlock(item.type)}
            >
              <Plus className="h-3.5 w-3.5" />
              {item.label}
            </Button>
          ))}
          {availableBlocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              All single-use blocks are already in the layout.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
