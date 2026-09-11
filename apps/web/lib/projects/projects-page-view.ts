export const PROJECTS_PAGE_VIEWS = ['table', 'timeline', 'kanban'] as const;

export type ProjectsPageView = (typeof PROJECTS_PAGE_VIEWS)[number];

const STORAGE_PREFIX = 'ozer-projects-view:';

export function projectsPageViewStorageKey(accountSlug: string): string {
  return `${STORAGE_PREFIX}${accountSlug}`;
}

export function parseProjectsPageView(
  value: string | null | undefined,
): ProjectsPageView | null {
  if (value === 'table' || value === 'timeline' || value === 'kanban') {
    return value;
  }

  return null;
}

export function readProjectsPageView(
  accountSlug: string,
): ProjectsPageView | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return parseProjectsPageView(
      window.localStorage.getItem(projectsPageViewStorageKey(accountSlug)),
    );
  } catch {
    return null;
  }
}

export function writeProjectsPageView(
  accountSlug: string,
  view: ProjectsPageView,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(projectsPageViewStorageKey(accountSlug), view);
  } catch {
    // Ignore quota / private-mode failures; the in-session view still works.
  }
}
