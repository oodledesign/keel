import { NoteEditorScrollShell } from '../_components/note-editor-scroll-shell';

export default function NoteDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NoteEditorScrollShell>{children}</NoteEditorScrollShell>;
}
