'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import type { LinkOption } from '../../_lib/workspace-content/types';

export type LinkValue = { type: LinkOption['type']; id: string } | null;

function encodeLink(link: LinkValue): string {
  if (!link) return '__none__';
  return `${link.type}:${link.id}`;
}

function decodeLink(value: string): LinkValue {
  if (value === '__none__') return null;
  const [type, id] = value.split(':');
  if (!type || !id) return null;
  return { type: type as LinkOption['type'], id };
}

export function LinkToSelect({
  options,
  value,
  onChange,
  placeholder = 'Link to (optional)',
  disabled,
}: {
  options: LinkOption[];
  value: LinkValue;
  onChange: (v: LinkValue) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={encodeLink(value)}
      onValueChange={(v) => onChange(decodeLink(v))}
      disabled={disabled}
    >
      <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)]">
        <SelectItem value="__none__">None</SelectItem>
        {options.map((opt) => (
          <SelectItem
            key={`${opt.type}:${opt.id}`}
            value={`${opt.type}:${opt.id}`}
            className="items-start"
          >
            <span className="line-clamp-2 break-words">
              {opt.label}
              <span className="ml-2 text-xs capitalize opacity-60">
                ({opt.type === 'job' ? 'project' : opt.type})
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
