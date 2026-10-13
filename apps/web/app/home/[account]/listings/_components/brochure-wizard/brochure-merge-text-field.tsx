'use client';

import { useEffect, useRef } from 'react';

import Placeholder from '@tiptap/extension-placeholder';
import {
  type Editor,
  EditorContent,
  type JSONContent,
  useEditor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Braces } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import { BROCHURE_MERGE_FIELDS } from '~/lib/commercial/brochure-pdf/brochure-merge-fields';
import {
  BrochureMergeFieldNode,
  SingleLineDocument,
  mergeTextDoc,
  mergeTextLine,
  mergeTextLines,
} from '~/lib/commercial/brochure-pdf/brochure-merge-text';

const PILL_CLASS =
  'mx-px inline-block rounded-full bg-[var(--ozer-accent-subtle)] px-1.5 align-baseline text-[0.85em] leading-[1.45] font-medium whitespace-nowrap text-[var(--ozer-accent)] [&.ProseMirror-selectednode]:ring-1 [&.ProseMirror-selectednode]:ring-[var(--ozer-accent)]';

function textOf(editor: Editor): string {
  return editor.getText({ blockSeparator: '\n' });
}

export function BrochureMergeFieldHint() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
      <Braces className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        Use the braces button in a field to add listing details such as rent or
        size. They show as{' '}
        <span className={cn(PILL_CLASS, 'text-[11px]')}>Rent</span> here and as
        the listing&apos;s current value in the PDF.
      </span>
    </p>
  );
}

/**
 * Plain text field where `{Rent}`-style merge fields show as pills. The value
 * stays plain text with the tokens in it, as the PDF expects. The braces
 * button inserts a field at the caret; typing `{Rent}` works too.
 */
export function BrochureMergeTextField({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  label,
  describedBy,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  /** Minimum height in lines when multiline. */
  rows?: number;
  placeholder?: string;
  /** Accessible name; the visible label sits outside. */
  label: string;
  describedBy?: string;
  className?: string;
}) {
  const onChangeRef = useRef(onChange);
  const editorRef = useRef<Editor | null>(null);
  const focusedOnce = useRef(false);
  /** What this field last reported. Echoes of earlier keystrokes can arrive while typing, so props only replace the content when the field isn't focused. */
  const emitted = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        document: multiline ? undefined : false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        trailingNode: false,
        underline: false,
      }),
      ...(multiline ? [] : [SingleLineDocument]),
      BrochureMergeFieldNode.configure({ pillClass: PILL_CLASS }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: mergeTextDoc(value, multiline),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': multiline ? 'true' : 'false',
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: cn(
          'w-full px-3 pr-9 text-sm outline-none',
          multiline ? 'py-2 leading-relaxed' : 'py-[7px] leading-5',
          '[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:w-full [&_p.is-editor-empty:first-child::before]:truncate [&_p.is-editor-empty:first-child::before]:text-[var(--workspace-shell-text-muted)] [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
        ),
        style: multiline ? `min-height: ${rows * 1.625 + 1}rem` : '',
      },
      handleKeyDown: (_view, event) =>
        !multiline && event.key === 'Enter' && !event.isComposing,
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (text == null || !editorRef.current) return false;
        const lines = mergeTextLines(text, multiline);
        const content: JSONContent[] =
          lines.length === 1
            ? (mergeTextLine(lines[0] ?? '') ?? [])
            : mergeTextDoc(text, multiline).content;
        editorRef.current.chain().insertContent(content).run();
        return true;
      },
    },
    onFocus: () => {
      focusedOnce.current = true;
    },
    onUpdate: ({ editor: current }) => {
      emitted.current = textOf(current);
      onChangeRef.current(emitted.current);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isFocused || value === emitted.current) return;
    emitted.current = value;
    if (textOf(editor) === value) return;
    editor.commands.setContent(mergeTextDoc(value, multiline), {
      emitUpdate: false,
    });
  }, [editor, value, multiline]);

  function insert(fieldLabel: string) {
    if (!editor) return;
    editor
      .chain()
      .focus(focusedOnce.current ? undefined : 'end')
      .insertContent({ type: 'mergeField', attrs: { label: fieldLabel } })
      .run();
  }

  return (
    <div
      className={cn(
        'border-input relative min-h-9 w-full min-w-0 rounded-md border bg-transparent shadow-2xs transition-colors focus-within:border-[var(--ozer-accent)]/50 hover:border-[var(--ozer-accent)]/30',
        className,
      )}
    >
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div
          aria-hidden
          className={cn(
            'px-3 pr-9 text-sm',
            multiline ? 'py-2' : 'py-[7px] leading-5',
          )}
          style={multiline ? { minHeight: `${rows * 1.625 + 1}rem` } : {}}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute top-1 right-1 h-7 w-7 text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent)]"
            aria-label={`Insert listing data into ${label}`}
            title="Insert listing data"
            disabled={!editor}
          >
            <Braces className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-80 w-52 overflow-y-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="text-xs font-normal text-[var(--workspace-shell-text-muted)]">
            Insert listing data
          </DropdownMenuLabel>
          {BROCHURE_MERGE_FIELDS.map((field) => (
            <DropdownMenuItem
              key={field.label}
              className="text-xs"
              onSelect={() => insert(field.label)}
            >
              {field.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
