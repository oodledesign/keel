'use client';

import { useEffect, useRef } from 'react';

import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { cn } from '@kit/ui/utils';

import { NoteMarkdownToolbar } from './note-markdown-toolbar';

type NoteBodyEditorProps = {
  initialMarkdown: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  toolbarClassName?: string;
  onEditorReady?: (editor: Editor | null) => void;
};

export function NoteBodyEditor({
  initialMarkdown,
  onChange,
  placeholder = 'Start writing…',
  className,
  toolbarClassName,
  onEditorReady,
}: NoteBodyEditorProps) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      Markdown,
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: cn(
          'note-body-editor min-h-[50vh] w-full px-4 pt-1 pb-4 text-base leading-relaxed text-[var(--workspace-shell-text)] outline-none sm:px-6 lg:px-10 lg:text-[15px] xl:px-14',
          '[&_h1]:font-heading [&_h1]:mb-3 [&_h1]:text-[1.75rem] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight lg:[&_h1]:text-3xl',
          '[&_h2]:font-heading [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold lg:[&_h2]:text-2xl',
          '[&_p]:mb-3 [&_p:last-child]:mb-0',
          '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_li]:my-0.5',
          '[&_strong]:font-semibold',
          '[&_em]:italic',
          '[&_u]:underline',
          '[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-[var(--workspace-shell-text-muted)] [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
        ),
        'aria-label': 'Note content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getMarkdown());
    },
  });

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  return (
    <div className={cn('flex flex-col', className)}>
      <NoteMarkdownToolbar editor={editor} className={toolbarClassName} />
      <EditorContent editor={editor} />
    </div>
  );
}
