'use client';

import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@kit/ui/utils';

const LOGO_LIGHT = '/brand/keel-logo-light.png';
const LOGO_DARK = '/brand/keel-logo-dark.png';

function LogoImage({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex h-8 w-[100px] shrink-0 items-center overflow-hidden lg:h-9 lg:w-[120px]',
        className,
      )}
    >
      <Image
        src={LOGO_LIGHT}
        alt="Keel"
        width={120}
        height={32}
        className="h-full w-auto max-w-full object-contain object-left dark:hidden"
        priority
      />
      <Image
        src={LOGO_DARK}
        alt=""
        width={120}
        height={32}
        className="absolute inset-y-0 left-0 hidden h-full w-auto max-w-full object-contain object-left dark:block"
        priority
        aria-hidden
      />
    </span>
  );
}

export function AppLogo({
  href,
  label,
  className,
}: {
  href?: string | null;
  className?: string;
  label?: string;
}) {
  if (href === null) {
    return <LogoImage className={className} />;
  }

  return (
    <Link
      aria-label={label ?? 'Home Page'}
      href={href ?? '/'}
      prefetch={true}
      className="inline-flex shrink-0"
    >
      <LogoImage className={className} />
    </Link>
  );
}
