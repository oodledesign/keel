import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

export type SupportPartyMark = {
  name: string;
  logoUrl?: string | null;
};

type Size = 'sm' | 'md' | 'lg';

const sizeClass: Record<Size, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function SupportPartyIdentity({
  party,
  size = 'md',
  className,
  nameClassName,
  showName = true,
}: {
  party: SupportPartyMark;
  size?: Size;
  className?: string;
  nameClassName?: string;
  showName?: boolean;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <ProfileAvatar
        displayName={party.name}
        pictureUrl={party.logoUrl}
        className={sizeClass[size]}
      />
      {showName ? (
        <span
          className={cn(
            'truncate text-sm text-[var(--workspace-shell-text)]',
            nameClassName,
          )}
        >
          {party.name}
        </span>
      ) : null}
    </div>
  );
}

/** Client + business marks for support headers and ticket cards. */
export function SupportDualPartyIdentity({
  client,
  business,
  size = 'md',
  className,
  layout = 'row',
}: {
  client?: SupportPartyMark | null;
  business?: SupportPartyMark | null;
  size?: Size;
  className?: string;
  layout?: 'row' | 'stack';
}) {
  if (!client && !business) return null;

  return (
    <div
      className={cn(
        layout === 'stack'
          ? 'flex flex-col gap-2'
          : 'flex flex-wrap items-center gap-3',
        className,
      )}
    >
      {business ? (
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Business
          </p>
          <SupportPartyIdentity party={business} size={size} />
        </div>
      ) : null}
      {client ? (
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Client
          </p>
          <SupportPartyIdentity party={client} size={size} />
        </div>
      ) : null}
    </div>
  );
}
