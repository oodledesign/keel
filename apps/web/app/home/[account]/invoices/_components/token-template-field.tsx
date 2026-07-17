'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { cn } from '@kit/ui/utils';

import { INVOICE_SMART_FIELD_PILLS } from '../_lib/invoice-smart-fields';

const TOKEN_RE = /\{\{[a-zA-Z0-9._]+\}\}/g;

export type TokenTemplateFieldHandle = {
  insertToken: (token: string) => void;
  focus: () => void;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function labelForToken(token: string) {
  const known = INVOICE_SMART_FIELD_PILLS.find((pill) => pill.token === token);
  if (known) return known.label;
  return token.replace(/^\{\{|\}\}$/g, '');
}

function valueToHtml(value: string) {
  const parts: string[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(
        escapeHtml(value.slice(lastIndex, index)).replace(/\n/g, '<br>'),
      );
    }
    const token = match[0];
    const label = escapeHtml(labelForToken(token));
    parts.push(
      `<span contenteditable="false" data-token="${escapeAttr(token)}" class="invoice-token-pill inline-flex items-center gap-1 align-baseline rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)] mx-0.5 select-none">${label}<button type="button" data-remove-token="true" class="rounded-full p-0.5 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]" aria-label="Remove ${label}"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></span>`,
    );
    lastIndex = index + token.length;
  }
  if (lastIndex < value.length) {
    parts.push(escapeHtml(value.slice(lastIndex)).replace(/\n/g, '<br>'));
  }
  return parts.join('') || '';
}

function serializeEditor(root: HTMLElement): string {
  let result = '';

  const walk = (nodes: NodeListOf<ChildNode>) => {
    Array.from(nodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? '';
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      if (el.dataset.token) {
        result += el.dataset.token;
        return;
      }
      if (el.tagName === 'BR') {
        result += '\n';
        return;
      }
      if (
        (el.tagName === 'DIV' || el.tagName === 'P') &&
        result.length > 0 &&
        !result.endsWith('\n')
      ) {
        result += '\n';
      }
      walk(el.childNodes);
    });
  };

  walk(root.childNodes);
  return result.replace(/\u00a0/g, ' ');
}

export const TokenTemplateField = forwardRef<
  TokenTemplateFieldHandle,
  {
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
    rows?: number;
    className?: string;
    placeholder?: string;
    'aria-label'?: string;
    onFocusCapture?: () => void;
  }
>(function TokenTemplateField(
  {
    value,
    onChange,
    multiline = false,
    rows = 3,
    className,
    placeholder,
    'aria-label': ariaLabel,
    onFocusCapture,
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  const syncDomFromValue = (next: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = valueToHtml(next);
  };

  useEffect(() => {
    if (value === lastEmitted.current) return;
    syncDomFromValue(value);
    lastEmitted.current = value;
  }, [value]);

  useEffect(() => {
    syncDomFromValue(value);
    lastEmitted.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitFromDom = () => {
    const el = editorRef.current;
    if (!el) return;
    const next = serializeEditor(el);
    lastEmitted.current = next;
    onChange(next);
  };

  useImperativeHandle(ref, () => ({
    insertToken: (token: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const selection = window.getSelection();
      const temp = document.createElement('div');
      temp.innerHTML = valueToHtml(token);
      const node = temp.firstChild;
      if (!node) return;

      if (
        selection &&
        selection.rangeCount > 0 &&
        el.contains(selection.anchorNode)
      ) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        // trailing space for easier continued typing
        const space = document.createTextNode(' ');
        range.setStartAfter(node);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        if (el.innerHTML && !el.innerHTML.endsWith(' ')) {
          el.appendChild(document.createTextNode(' '));
        }
        el.appendChild(node);
        el.appendChild(document.createTextNode(' '));
      }
      emitFromDom();
    },
    focus: () => editorRef.current?.focus(),
  }));

  const minHeight = multiline ? `${Math.max(rows, 2) * 1.5}rem` : undefined;

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline || undefined}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={cn(
        'border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        multiline ? 'min-h-[80px] whitespace-pre-wrap' : 'min-h-9',
        !value &&
          'empty:before:text-muted-foreground empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)]',
        className,
      )}
      style={minHeight ? { minHeight } : undefined}
      onFocus={onFocusCapture}
      onInput={emitFromDom}
      onBlur={emitFromDom}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-remove-token="true"]')) {
          e.preventDefault();
          const pill = target.closest('[data-token]') as HTMLElement | null;
          pill?.remove();
          emitFromDom();
        }
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
        }
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          if (!range.collapsed) return;
          const node = range.startContainer;
          if (node.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
            const prev = node.previousSibling as HTMLElement | null;
            if (prev?.dataset?.token) {
              e.preventDefault();
              prev.remove();
              emitFromDom();
            }
          }
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const temp = document.createElement('div');
        temp.innerHTML = valueToHtml(text);
        const frag = document.createDocumentFragment();
        while (temp.firstChild) frag.appendChild(temp.firstChild);
        range.insertNode(frag);
        emitFromDom();
        // Re-render so tokens become pills consistently
        const next = serializeEditor(editorRef.current!);
        lastEmitted.current = next;
        onChange(next);
        syncDomFromValue(next);
      }}
    />
  );
});
