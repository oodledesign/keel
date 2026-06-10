'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Label } from '@kit/ui/label';

import {
  NOTE_FILE_CATEGORY_LABELS,
  NOTE_FILE_CATEGORY_OPTIONS,
  type NoteFileCategory,
} from '../../_lib/workspace-content/types';

export function CategorySelect({
  value,
  onChange,
  disabled,
}: {
  value: NoteFileCategory;
  onChange: (value: NoteFileCategory) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300">Category</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as NoteFileCategory)}
        disabled={disabled}
      >
        <SelectTrigger className="border-white/10 bg-[var(--workspace-shell-panel)] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NOTE_FILE_CATEGORY_OPTIONS.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {NOTE_FILE_CATEGORY_LABELS[cat]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CategoryBadge({ category }: { category: NoteFileCategory }) {
  return (
    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium capitalize text-zinc-300">
      {NOTE_FILE_CATEGORY_LABELS[category]}
    </span>
  );
}
