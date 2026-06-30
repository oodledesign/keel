'use client';

import { useCallback, useRef, useState } from 'react';

import { Bold, Heading2, Heading3, Italic, Link2 } from 'lucide-react';

import { cn } from '@kit/ui/utils';

type SimpleMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  rows?: number;
  className?: string;
};

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = 'text',
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const next =
    textarea.value.slice(0, start) +
    before +
    selected +
    after +
    textarea.value.slice(end);

  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;

  return { next, cursorStart, cursorEnd };
}

function prefixLines(
  textarea: HTMLTextAreaElement,
  prefix: string,
  placeholder = 'Heading',
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const block = selected
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');

  const next =
    textarea.value.slice(0, start) + block + textarea.value.slice(end);

  return { next, cursorStart: start, cursorEnd: start + block.length };
}

export function SimpleMarkdownEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  rows = 12,
  className,
}: SimpleMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{
    top: number;
    left: number;
    visible: boolean;
  }>({ top: 0, left: 0, visible: false });

  const applyWrap = useCallback(
    (before: string, after: string, placeholderText?: string) => {
      const textarea = textareaRef.current;
      if (!textarea || readOnly) return;

      const { next, cursorStart, cursorEnd } = wrapSelection(
        textarea,
        before,
        after,
        placeholderText,
      );
      onChange(next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorStart, cursorEnd);
      });
      setSelectionToolbar((current) => ({ ...current, visible: false }));
    },
    [onChange, readOnly],
  );

  const applyPrefix = useCallback(
    (prefix: string, placeholderText?: string) => {
      const textarea = textareaRef.current;
      if (!textarea || readOnly) return;

      const { next, cursorStart, cursorEnd } = prefixLines(
        textarea,
        prefix,
        placeholderText,
      );
      onChange(next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorStart, cursorEnd);
      });
      setSelectionToolbar((current) => ({ ...current, visible: false }));
    },
    [onChange, readOnly],
  );

  const applyLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || readOnly) return;

    const url = window.prompt('Link URL', 'https://');
    if (!url) return;

    applyWrap('[', `](${url})`, 'link text');
  }, [applyWrap, readOnly]);

  const updateSelectionToolbar = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || readOnly) return;

    if (textarea.selectionStart === textarea.selectionEnd) {
      setSelectionToolbar((current) => ({ ...current, visible: false }));
      return;
    }

    const rect = textarea.getBoundingClientRect();
    setSelectionToolbar({
      visible: true,
      top: Math.max(8, rect.top - 44),
      left: rect.left + 12,
    });
  }, [readOnly]);

  const toolbarButtonClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]';

  return (
    <div className={cn('relative', className)}>
      {!readOnly ? (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 p-1">
          <button
            type="button"
            className={toolbarButtonClass}
            aria-label="Bold"
            onClick={() => applyWrap('**', '**', 'bold text')}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            aria-label="Italic"
            onClick={() => applyWrap('*', '*', 'italic text')}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            aria-label="Heading 2"
            onClick={() => applyPrefix('## ', 'Section heading')}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            aria-label="Heading 3"
            onClick={() => applyPrefix('### ', 'Subheading')}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            aria-label="Link"
            onClick={applyLink}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <span className="ml-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
            Stored as Markdown
          </span>
        </div>
      ) : null}

      {selectionToolbar.visible && !readOnly ? (
        <div
          className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[#1A2535] p-1 shadow-lg"
          style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
        >
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => applyWrap('**', '**')}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => applyWrap('*', '*')}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={applyLink}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onSelect={updateSelectionToolbar}
        onBlur={() =>
          setTimeout(
            () => setSelectionToolbar((current) => ({ ...current, visible: false })),
            150,
          )
        }
        className="w-full resize-y rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 px-3 py-2.5 text-sm leading-relaxed text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]"
      />
    </div>
  );
}
