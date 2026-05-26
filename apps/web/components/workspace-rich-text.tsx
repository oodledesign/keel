'use client';

import { useCallback, useEffect, useRef } from 'react';

import { Bold, Italic, Link2, List, ListOrdered } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';

type WorkspaceRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
};

export function WorkspaceRichTextEditor({
  value,
  onChange,
  placeholder = 'Write here…',
  minHeight = 120,
  className,
}: WorkspaceRichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = value || '';
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }, [value]);

  const sync = useCallback(() => {
    const html = ref.current?.innerHTML ?? '';
    onChange(sanitizeCommunityHtml(html));
  }, [onChange]);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    sync();
  };

  const addLink = () => {
    const url = window.prompt('Link URL (https://…)');
    if (!url?.trim()) return;
    exec('createLink', url.trim());
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-white/10 bg-white/5',
        className,
      )}
    >
      <div className="flex flex-wrap gap-0.5 border-b border-white/10 p-1">
        <ToolbarBtn label="Bold" onClick={() => exec('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Italic" onClick={() => exec('italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Bullet list" onClick={() => exec('insertUnorderedList')}>
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Numbered list" onClick={() => exec('insertOrderedList')}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Link" onClick={addLink}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        className={cn(
          'workspace-rich-text-editor min-w-0 px-3 py-2 text-sm text-white outline-none',
          'empty:before:pointer-events-none empty:before:text-white/35 empty:before:content-[attr(data-placeholder)]',
          '[&_a]:text-[#5eead4] [&_a]:underline',
          '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_p]:my-1',
        )}
        style={{ minHeight }}
      />
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

type WorkspaceRichTextHtmlProps = {
  html: string;
  className?: string;
};

/** Render sanitized HTML from rich text fields. */
export function WorkspaceRichTextHtml({ html, className }: WorkspaceRichTextHtmlProps) {
  const safe = sanitizeCommunityHtml(html);
  if (!safe.trim()) return null;

  return (
    <div
      className={cn(
        'workspace-rich-text-html text-sm leading-relaxed text-white/80',
        '[&_a]:text-[#5eead4] [&_a]:underline',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:my-1',
        '[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white',
        '[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
