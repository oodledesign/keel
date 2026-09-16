import { cn } from '@kit/ui/utils';

const WORD_RE = /[A-Za-z0-9]+/g;

/** First letter of each word — "Contract Sent" → "CS", "On Hold" → "OH". */
export function kanbanColumnInitials(label: string): string {
  const words = label.match(WORD_RE) ?? [];
  if (words.length === 0) {
    return '';
  }

  return words.map((word) => word[0]!.toUpperCase()).join('');
}

export function isKanbanColumnMinimized({
  isEmpty,
  isOver,
}: {
  isEmpty: boolean;
  isOver: boolean;
}): boolean {
  return isEmpty && !isOver;
}

export function kanbanColumnWidthClass(isMinimized: boolean): string {
  return isMinimized ? 'w-10 min-w-10' : 'w-[min(100%,240px)] md:w-60';
}

export function kanbanColumnHeaderClassName({
  minimized = false,
  className,
}: {
  minimized?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'sticky top-0 z-10 shrink-0 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] py-2.5',
    minimized ? 'px-1' : 'px-3',
    className,
  );
}

export function kanbanColumnClassName({
  isEmpty,
  isOver,
}: {
  isEmpty: boolean;
  isOver: boolean;
}): string {
  const isMinimized = isKanbanColumnMinimized({ isEmpty, isOver });

  return cn(
    'flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] transition-[width,border-color,background-color] duration-200 ease-out',
    kanbanColumnWidthClass(isMinimized),
    isOver && 'border-[var(--ozer-accent)]/40 bg-[color:var(--ozer-accent)]/5',
  );
}

export const kanbanBoardClassName =
  'flex h-full min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2';
