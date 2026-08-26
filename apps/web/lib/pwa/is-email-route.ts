import { normalizePublicPathname } from './normalize-public-pathname';

/** Workspace email assistant inbox (not suggested-tasks sub-routes). */
export function isEmailRoute(pathname: string): boolean {
  const normalized = normalizePublicPathname(pathname);
  return /^\/app\/(?:[^/]+\/)?email\/?$/.test(normalized);
}
