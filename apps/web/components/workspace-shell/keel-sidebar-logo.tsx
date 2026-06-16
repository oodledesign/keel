import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { KeelLogoMark } from '~/components/keel-logo-mark';
import pathsConfig from '~/config/paths.config';
import { APP_LOGO_SIDEBAR_CLASSNAME } from '~/lib/app-logo-shell';

export function KeelSidebarLogo(props: {
  href?: string | null;
  collapsed?: boolean;
  className?: string;
}) {
  const href = props.href ?? pathsConfig.app.home;
  const collapsed = props.collapsed ?? false;

  const image = (
    <KeelLogoMark
      collapsed={collapsed}
      tone="dark"
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
      prefetch
      className="mb-2 inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A9D8F]"
      aria-label="Keel home"
    >
      {image}
    </Link>
  );
}

/** Marketing / light surfaces */
export function KeelLogoLight(props: { className?: string }) {
  return <KeelLogoMark tone="light" className={props.className} />;
}
