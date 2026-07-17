'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
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
            className="cursor-pointer border-[color:var(--workspace-shell-border)] text-xs text-[var(--workspace-shell-text-muted)]"
            onClick={() => !disabled && onChange(tags.filter((x) => x !== tag))}
          >
            {tag} ×
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add tag"
          disabled={disabled}
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-base text-[var(--workspace-shell-text)] md:text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] md:hidden"
          disabled={disabled || !draft.trim()}
          onClick={addTag}
        >
          Add
        </Button>
      </div>
      <p className="hidden text-xs text-[var(--workspace-shell-text-muted)] md:block">
        Press Enter to add a tag
      </p>
    </div>
  );
}
