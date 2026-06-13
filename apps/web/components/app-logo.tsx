'use client';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { KeelLogoMark } from '~/components/keel-logo-mark';

export function AppLogo({
  href,
  label,
  className,
}: {
  href?: string | null;
  className?: string;
  label?: string;
}) {
  const logo = <KeelLogoMark className={className} />;

  if (href === null) {
    return logo;
  }

  return (
    <Link
      aria-label={label ?? 'Home Page'}
      href={href ?? '/'}
      prefetch={true}
      className={cn('inline-flex shrink-0')}
    >
      {logo}
    </Link>
  );
}
