import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

export function PlannerClientAvatar({
  name,
  pictureUrl,
  color,
  className,
  fallbackClassName,
}: {
  name: string;
  pictureUrl?: string | null;
  color?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const trimmed = name.trim();
  const initial = (trimmed[0] ?? '?').toUpperCase();

  return (
    <Avatar className={cn('h-4 w-4 shrink-0', className)}>
      {pictureUrl ? (
        <AvatarImage src={pictureUrl} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback
        className={cn(
          'rounded-full text-[9px] font-semibold text-[var(--workspace-shell-text)]',
          fallbackClassName,
        )}
        style={{ backgroundColor: color ?? '#64748B' }}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

export function PlannerClientPill({
  name,
  pictureUrl,
  color,
  className,
}: {
  name: string;
  pictureUrl?: string | null;
  color?: string | null;
  className?: string;
}) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  return (
    <span
      className={cn(
        'inline-flex max-w-[9rem] shrink-0 items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] py-0.5 pl-0.5 pr-2 text-[10px] font-medium leading-none text-[var(--workspace-shell-text-muted)]',
        className,
      )}
      title={trimmed}
    >
      <PlannerClientAvatar name={trimmed} pictureUrl={pictureUrl} color={color} />
      <span className="truncate">{trimmed}</span>
    </span>
  );
}
