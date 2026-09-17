import pathsConfig from '~/config/paths.config';

import { SHORTCUT_CATALOG_ROUTE } from './catalog-ids';
import { normalizeAppHref } from './personal-home-url';
import { resolveShortcutHref } from './resolve-href';
import type { DefaultLandingPreference } from './types';

export type WorkspaceLandingPageOption = {
  catalogId: string;
  params: Record<string, string>;
  label: string;
  href: string;
};

export function workspaceHomeLandingPage(
  slug: string,
): WorkspaceLandingPageOption {
  const href = pathsConfig.app.accountHome.replace('[account]', slug);
  return {
    catalogId: SHORTCUT_CATALOG_ROUTE,
    params: { href },
    label: 'Workspace home',
    href,
  };
}

export function landingPageValue(
  page: Pick<WorkspaceLandingPageOption, 'href'>,
) {
  return normalizeAppHref(page.href);
}

export function isWorkspaceLandingHref(
  href: string,
  workspaceSlug: string,
): boolean {
  const slug = workspaceSlug.trim();
  if (!slug) return false;
  const path = (normalizeAppHref(href).split(/[?#]/)[0] ?? '').replace(
    /\/$/,
    '',
  );
  const home = pathsConfig.app.accountHome
    .replace('[account]', slug)
    .replace(/\/$/, '');
  return path === home || path.startsWith(`${home}/`);
}

export function resolveDefaultLandingHref(
  pref: DefaultLandingPreference,
): string | null {
  if (pref.type !== 'workspace' || !pref.workspaceSlug) return null;

  const home = pathsConfig.app.accountHome.replace(
    '[account]',
    pref.workspaceSlug,
  );

  if (!pref.catalogId) return home;

  const href = resolveShortcutHref(pref.catalogId, pref.params ?? {});
  if (!href) return home;
  if (!isWorkspaceLandingHref(href, pref.workspaceSlug)) return home;
  return href;
}
