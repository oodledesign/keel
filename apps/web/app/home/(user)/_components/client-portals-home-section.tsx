import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd, workspaceFocusRing } from '~/lib/workspace-ui';

import type { UserClientPortalMembership } from '../_lib/server/list-user-client-portal-memberships';

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function PortalBrandMark(props: {
  src: string | null;
  label: string;
  sizeClass: string;
}) {
  return (
    <Avatar
      className={`${props.sizeClass} border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]`}
    >
      {props.src ? <AvatarImage src={props.src} alt="" /> : null}
      <AvatarFallback className="text-xs font-semibold text-[var(--workspace-shell-text)]">
        {initials(props.label)}
      </AvatarFallback>
    </Avatar>
  );
}

export function ClientPortalsHomeSection(props: {
  portals: UserClientPortalMembership[];
}) {
  if (props.portals.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 mb-6 md:mx-6 lg:mx-8">
      <h2 className="px-1 text-sm font-semibold text-[var(--workspace-shell-text)]">
        Client portals
      </h2>
      <p className="mt-1 px-1 text-xs text-[var(--workspace-shell-text-muted)]">
        Portals you have contact access to.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {props.portals.map((portal) => {
          const primaryLogo = portal.clientLogoUrl || portal.agencyLogoUrl;
          const secondaryLogo =
            portal.agencyLogoUrl &&
            portal.agencyLogoUrl !== portal.clientLogoUrl
              ? portal.agencyLogoUrl
              : null;
          const showAgencyLine =
            portal.agencyName.trim().toLowerCase() !==
            portal.name.trim().toLowerCase();

          return (
            <li key={portal.clientOrgId}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 shadow-[0_1px_0_color-mix(in_srgb,var(--workspace-shell-text)_6%,transparent)]">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <PortalBrandMark
                      src={primaryLogo}
                      label={portal.name}
                      sizeClass="size-12"
                    />
                    {secondaryLogo ? (
                      <div className="absolute -right-1 -bottom-1">
                        <PortalBrandMark
                          src={secondaryLogo}
                          label={portal.agencyName}
                          sizeClass="size-7"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
                      {portal.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                      {showAgencyLine
                        ? `Client portal · via ${portal.agencyName}`
                        : 'Client portal access'}
                    </p>
                  </div>
                </div>

                <div className="mt-auto">
                  <Link
                    href={pathsConfig.app.clientPortalHome.replace(
                      '[clientSlug]',
                      portal.slug,
                    )}
                    aria-label={`Open ${portal.name} client portal`}
                    className={`${workspaceBtnPrimaryMd} ${workspaceFocusRing} inline-flex w-full items-center justify-center gap-1.5 outline-none focus-visible:ring-2`}
                  >
                    Open portal
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
