'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';

type StringListEditorProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
  addLabel?: string;
};

export function StringListEditor({
  values,
  onChange,
  placeholder = 'Add an item…',
  multiline = false,
  addLabel = 'Add item',
}: StringListEditorProps) {
  const updateAt = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          {multiline ? (
            <Textarea
              value={value}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="min-h-[4.5rem] flex-1"
            />
          ) : (
            <Input
              value={value}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove"
            onClick={() => removeAt(index)}
            className="shrink-0 text-[var(--workspace-shell-text-muted)]"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...values, ''])}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
