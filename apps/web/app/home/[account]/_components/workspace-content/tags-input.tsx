'use client';

import { useState } from 'react';

import { Badge } from '@kit/ui/badge';
import { Input } from '@kit/ui/input';

export function TagsInput({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const t = draft.trim();
    if (!t || tags.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...tags, t]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="cursor-pointer border-white/10 text-xs text-zinc-300"
            onClick={() => !disabled && onChange(tags.filter((x) => x !== tag))}
          >
            {tag} ×
          </Badge>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder="Add tag, press Enter"
        disabled={disabled}
        className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
      />
    </div>
  );
}
