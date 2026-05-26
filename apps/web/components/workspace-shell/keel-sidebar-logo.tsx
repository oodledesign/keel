import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

const LOGO_DARK = '/brand/keel-logo-dark.png';
const LOGO_LIGHT = '/brand/keel-logo-light.png';
const LOGO_ICON = '/brand/keel-logo-icon.png';

export function KeelSidebarLogo(props: {
  href?: string | null;
  collapsed?: boolean;
  className?: string;
}) {
  const href = props.href ?? pathsConfig.app.home;
  const collapsed = props.collapsed ?? false;

  const image = (
    <Image
      src={collapsed ? LOGO_ICON : LOGO_DARK}
      alt="Keel"
      width={collapsed ? 32 : 120}
      height={collapsed ? 32 : 32}
      className={cn(
        'h-8 w-auto object-contain object-left',
        collapsed && 'h-8 w-8 object-center',
        props.className,
      )}
      priority
    />
  );

  if (props.href === null) {
    return image;
  }

  return (
    <Link
      href={href}
      prefetch
      className="mb-3 inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A9D8F]"
      aria-label="Keel home"
    >
      {image}
    </Link>
  );
}

/** Marketing / light surfaces */
export function KeelLogoLight(props: { className?: string }) {
  return (
    <Image
      src={LOGO_LIGHT}
      alt="Keel"
      width={120}
      height={32}
      className={cn('h-8 w-auto object-contain', props.className)}
      priority
    />
  );
}
