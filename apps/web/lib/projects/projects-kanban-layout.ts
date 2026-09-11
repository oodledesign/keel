import { cn } from '@kit/ui/utils';

export function kanbanColumnWidthClass(isEmpty: boolean): string {
  return isEmpty
    ? 'w-[5.5rem] min-w-[5.5rem] md:w-24'
    : 'w-[min(100%,240px)] md:w-60';
}

export function kanbanColumnClassName({
  isEmpty,
  isOver,
}: {
  isEmpty: boolean;
  isOver: boolean;
}): string {
  return cn(
    'flex min-h-[280px] shrink-0 flex-col rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] transition-[width,border-color,background-color]',
    kanbanColumnWidthClass(isEmpty),
    isOver && 'border-[var(--ozer-accent)]/40 bg-[color:var(--ozer-accent)]/5',
  );
}
