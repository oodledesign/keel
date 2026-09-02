import { normalizePublicPathname } from './normalize-public-pathname';

/** Full-screen note editor (create or edit — not the notes list). */
export function isNoteEditorRoute(pathname: string): boolean {
  const normalized = normalizePublicPathname(pathname);
  return /^\/app\/(?:[^/]+\/)?notes\/(?:new|[^/]+)\/?$/.test(normalized);
}
