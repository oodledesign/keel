'use client';

import { useCallback, useEffect, useRef } from 'react';

import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';

type DocumentRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  readOnly?: boolean;
};

export function DocumentRichTextEditor({
  value,
  onChange,
  placeholder = 'Write your document…',
  minHeight = 400,
  className,
  readOnly = false,
}: DocumentRichTextEditorProps) {
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

  const exec = (command: string, val?: string) => {
    if (readOnly) return;
    ref.current?.focus();
    document.execCommand(command, false, val);
    sync();
  };

  const addLink = () => {
    if (readOnly) return;
    const url = window.prompt('Link URL (https://…)');
    if (!url?.trim()) return;
    exec('createLink', url.trim());
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] text-[var(--ozer-text-on-light)]',
        className,
      )}
    >
      {!readOnly ? (
        <div className="flex flex-wrap gap-1 border-b border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-2 py-1.5">
          <ToolbarButton
            onClick={() => exec('formatBlock', 'h1')}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => exec('formatBlock', 'h2')}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => exec('formatBlock', 'h3')}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => exec('formatBlock', 'p')}
            title="Paragraph"
          >
            P
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('bold')} title="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('italic')} title="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => exec('insertUnorderedList')}
            title="Bullet list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => exec('insertOrderedList')}
            title="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={addLink} title="Link">
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
      ) : null}
      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={sync}
        data-placeholder={placeholder}
        className={cn(
          'prose prose-sm max-w-none px-6 py-4 outline-none [&:empty]:before:text-[var(--workspace-shell-text-muted)] [&:empty]:before:content-[attr(data-placeholder)]',
          'prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
        )}
        style={{ minHeight }}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)]"
    >
      {children}
    </button>
  );
}

export function DocumentHtmlPreview({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-headings:font-semibold max-w-none rounded-xl border border-[color:var(--ozer-border-on-light)] bg-white px-6 py-4 text-[var(--ozer-text-on-light)]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeCommunityHtml(html) }}
    />
  );
}
