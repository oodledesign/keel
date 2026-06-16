import pathsConfig from '~/config/paths.config';

/** Query flag: user explicitly chose personal home (skip default-workspace redirect). */
export const EXPLICIT_PERSONAL_HOME_QUERY = 'personal';

export function getExplicitPersonalHomePath(): string {
  return `${pathsConfig.app.home}?${EXPLICIT_PERSONAL_HOME_QUERY}=1`;
}

export function isExplicitPersonalHomeRequest(
  searchParams: Pick<URLSearchParams, 'get'>,
): boolean {
  return searchParams.get(EXPLICIT_PERSONAL_HOME_QUERY) === '1';
}

export function isPersonalDashboardRoot(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';

  return normalized === '/app' || normalized === '/home';
}

/** Pathname portion of a nav href (strips query/hash for active-state checks). */
export function navHrefPathname(href: string): string {
  const withoutQuery = href.split(/[?#]/)[0] ?? href;

  return withoutQuery.replace(/\/$/, '') || '/';
}
