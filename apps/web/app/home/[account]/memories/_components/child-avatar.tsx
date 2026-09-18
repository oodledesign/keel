import { childInitials } from '../_lib/memory-constants';

export function ChildAvatar({
  name,
  url,
  size = 'md',
}: {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim =
    size === 'lg'
      ? 'h-16 w-16 text-lg'
      : size === 'sm'
        ? 'h-7 w-7 text-[10px]'
        : 'h-10 w-10 text-sm';

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={`${dim} rounded-full object-cover`} />
    );
  }

  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] font-semibold text-[var(--workspace-shell-accent-text)]`}
    >
      {childInitials(name)}
    </span>
  );
}
