'use client';

import { useState } from 'react';

import { X } from 'lucide-react';

import { Input } from '@kit/ui/input';

import { workspaceFilterActive, workspaceTextMuted } from '~/lib/workspace-ui';

export function KeywordChips(props: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const existing = new Set(props.value.map((k) => k.toLowerCase()));
    const next = [...props.value];
    for (const part of parts) {
      if (!existing.has(part.toLowerCase()) && next.length < 50) {
        next.push(part.slice(0, 100));
        existing.add(part.toLowerCase());
      }
    }
    props.onChange(next);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {props.value.map((keyword) => (
          <span
            key={keyword}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${workspaceFilterActive}`}
          >
            {keyword}
            <button
              type="button"
              aria-label={`Remove ${keyword}`}
              disabled={props.disabled}
              onClick={() =>
                props.onChange(props.value.filter((k) => k !== keyword))
              }
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        {props.value.length === 0 ? (
          <span className={`text-sm ${workspaceTextMuted}`}>
            No keywords yet
          </span>
        ) : null}
      </div>
      <Input
        value={draft}
        disabled={props.disabled}
        placeholder={props.placeholder ?? 'Type a keyword and press Enter'}
        onChange={(e) => {
          const value = e.target.value;
          if (value.endsWith(',')) add(value);
          else setDraft(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && props.value.length) {
            props.onChange(props.value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
