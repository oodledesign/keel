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
    // Pin to the page scroller (kanbanPageScrollClassName). Overflow on the
    // board or column would steal sticky and lock title/filters on screen.
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
    // overflow-visible: sticky headers pin to the page, not a column box.
    // min-h-full: empty columns still fill the board for drops / drag-expand.
    'flex min-h-full shrink-0 flex-col overflow-visible rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] transition-[width,border-color,background-color] duration-200 ease-out',
    kanbanColumnWidthClass(isMinimized),
    isOver && 'border-[var(--ozer-accent)]/40 bg-[color:var(--ozer-accent)]/5',
  );
}

export function kanbanColumnCardsClassName({
  isEmpty,
  className,
}: {
  isEmpty?: boolean;
  className?: string;
} = {}): string {
  return cn('flex flex-col gap-2 p-2', isEmpty && 'min-h-[200px]', className);
}

/**
 * Board views scroll the page (title / filters / toolbar leave) so only
 * column headings stay sticky. Table / other views keep a locked chrome
 * box and scroll their own inner list.
 */
export function kanbanPageScrollClassName(
  boardOwnsPageScroll: boolean,
): string {
  return boardOwnsPageScroll
    ? 'overflow-auto overscroll-contain'
    : 'overflow-hidden';
}

/** Flex row of columns — not a nested scroller (that would trap sticky). */
export const kanbanBoardClassName =
  'flex min-h-full flex-1 items-stretch gap-3 pb-2';
