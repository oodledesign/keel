import { Avatar, AvatarFallback } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

export function PlannerClientPill({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const initial = (trimmed[0] ?? '?').toUpperCase();

  return (
    <span
      className={cn(
        'inline-flex max-w-[9rem] shrink-0 items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] py-0.5 pl-0.5 pr-2 text-[10px] font-medium leading-none text-[var(--workspace-shell-text-muted)]',
        className,
      )}
      title={trimmed}
    >
      <Avatar className="h-4 w-4 shrink-0">
        <AvatarFallback
          className="rounded-full text-[9px] font-semibold text-[var(--workspace-shell-text)]"
          style={{ backgroundColor: color ?? '#64748B' }}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{trimmed}</span>
    </span>
  );
}
