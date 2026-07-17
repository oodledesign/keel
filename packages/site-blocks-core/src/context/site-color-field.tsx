'use client';

import { useState } from 'react';

/** Puck custom field for optional hex colour overrides. Empty = use design token. */
export function SiteColorField({
  value,
  onChange,
  label,
  placeholder = 'Use design token',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const hex = typeof value === 'string' ? value.trim() : '';
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#888888';

  function commit(next: string) {
    const trimmed = next.trim();
    if (!trimmed) {
      setError(null);
      onChange('');
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      setError('Use a 6-digit hex colour, e.g. #CC848A');
      return;
    }
    setError(null);
    onChange(trimmed);
  }

  return (
    <div className="space-y-2">
      {label ? <label className="text-xs font-medium">{label}</label> : null}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(event) => commit(event.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-[var(--sb-border,#d9d6cf)] bg-transparent"
        />
        <input
          type="text"
          value={hex}
          placeholder={placeholder}
          onChange={(event) => commit(event.target.value)}
          className="w-full rounded border px-2 py-1 font-mono text-xs"
        />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
