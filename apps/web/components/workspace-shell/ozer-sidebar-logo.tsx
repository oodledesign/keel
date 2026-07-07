import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { OzerLogoMark } from '~/components/ozer-logo-mark';
import pathsConfig from '~/config/paths.config';
import { APP_LOGO_SIDEBAR_CLASSNAME } from '~/lib/app-logo-shell';

export function OzerSidebarLogo(props: {
  href?: string | null;
  collapsed?: boolean;
  className?: string;
}) {
  const href = props.href ?? pathsConfig.app.home;
  const collapsed = props.collapsed ?? false;

  const image = (
    <OzerLogoMark
      collapsed={collapsed}
      tone="auto"
      className={cn(
        collapsed ? 'h-6 w-6' : APP_LOGO_SIDEBAR_CLASSNAME,
        props.className,
      )}
    />
  );

  if (props.href === null) {
    return image;
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className="mb-2 inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]"
      aria-label="Ozer home"
    >
      {image}
    </Link>
  );
}

/** Marketing / light surfaces — always cream wordmark */
export function OzerLogoLight(props: { className?: string }) {
  return <OzerLogoMark tone="light" className={props.className} />;
}

/** @deprecated Use OzerSidebarLogo */
export const KeelSidebarLogo = OzerSidebarLogo;

/** @deprecated Use OzerLogoLight */
export const KeelLogoLight = OzerLogoLight;
