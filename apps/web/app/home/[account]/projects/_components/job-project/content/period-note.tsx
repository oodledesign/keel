'use client';

import { useState } from 'react';

import { cn } from '@kit/ui/utils';

/** Click-to-edit text for a week or month note. Saves when focus leaves. */
export function PeriodNote({
  value,
  placeholder,
  canEdit,
  onSave,
  className,
  rows = 3,
}: {
  value: string;
  placeholder: string;
  canEdit: boolean;
  onSave: (body: string) => void;
  className?: string;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing && canEdit) {
    return (
      <textarea
        autoFocus
        value={draft}
        rows={rows}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          'nodrag nowheel w-full resize-none rounded-md border border-[color:var(--ozer-accent)] bg-[var(--workspace-shell-panel)] p-2 text-xs leading-snug outline-none',
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        'w-full rounded-md p-2 text-left text-xs leading-snug whitespace-pre-wrap transition-colors',
        value
          ? 'text-[var(--workspace-shell-text)]'
          : 'text-[var(--workspace-shell-text-muted)] italic',
        canEdit && 'hover:bg-[var(--workspace-shell-sidebar-accent)]',
        className,
      )}
    >
      {value || (canEdit ? placeholder : '—')}
    </button>
  );
}
