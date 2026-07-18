'use client';

import { useState } from 'react';

import { createUsePuck, type Plugin } from '@puckeditor/core';
import { GripVertical, Layers } from 'lucide-react';

const usePuck = createUsePuck();
// Puck root drop zone id (@puckeditor/core 0.22 — check on upgrade).
const ROOT_ZONE = 'root:default-zone';

function DraggableOutlinePanel() {
  const dispatch = usePuck((s) => s.dispatch);
  const content = usePuck((s) => s.appState.data.content);
  const config = usePuck((s) => s.config);
  const selectedId = usePuck((s) => s.selectedItem?.props?.id as string | undefined);
  const getPermissions = usePuck((s) => s.getPermissions);
  const canDrag = Boolean(getPermissions().drag);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function selectAt(index: number) {
    dispatch({
      type: 'setUi',
      ui: {
        itemSelector: { index, zone: ROOT_ZONE },
      },
    });
  }

  function reorder(sourceIndex: number, destinationIndex: number) {
    if (!canDrag || sourceIndex === destinationIndex) return;
    dispatch({
      type: 'reorder',
      sourceIndex,
      destinationIndex,
      destinationZone: ROOT_ZONE,
      recordHistory: true,
    });
  }

  if (!content.length) {
    return (
      <div className="p-3 text-xs text-[var(--workspace-shell-text-muted,#666)]">
        No blocks on this page yet. Drag blocks from the Blocks tab onto the
        canvas.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <p className="mb-2 px-1 text-[11px] text-[var(--workspace-shell-text-muted,#666)]">
        {canDrag
          ? 'Drag to reorder blocks on the page.'
          : 'Select a block to edit. Reordering is disabled for this role.'}
      </p>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {content.map((item, index) => {
          const id = String(item.props?.id ?? index);
          const label =
            config.components?.[item.type]?.label ?? item.type ?? 'Block';
          const selected = selectedId === id;

          return (
            <li key={id}>
              <div
                draggable={canDrag}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => {
                  if (!canDrag) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex == null) return;
                  reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-1 rounded-md border px-1.5 py-1.5 text-sm ${
                  selected
                    ? 'border-[var(--ozer-accent,#FF5C34)] bg-[var(--ozer-accent,#FF5C34)]/10'
                    : 'border-transparent hover:bg-[var(--workspace-shell-sidebar-accent,#f7f7f5)]'
                } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {canDrag ? (
                  <GripVertical
                    className="size-3.5 shrink-0 text-[var(--workspace-shell-text-muted,#999)]"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => selectAt(index)}
                >
                  {label}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Replaces Puck’s default Outline tab with a root-level drag-to-reorder list. */
export function createSiteOutlinePlugin(): Plugin {
  return {
    name: 'outline',
    label: 'Outline',
    icon: <Layers size={16} />,
    render: () => <DraggableOutlinePanel />,
  };
}
