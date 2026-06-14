/** Full-screen note editor (not the notes list). */
export function isNoteEditorRoute(pathname: string): boolean {
  return /\/notes\/(?!new(?:\/|$))[^/]+$/.test(pathname);
}
