'use client';

import { useState, useTransition } from 'react';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { createNoteCategoryAction } from '../../_lib/workspace-content/note-categories-actions';
import {
  getNoteCategoryLabel,
  NOTE_FILE_CATEGORY_OPTIONS,
  type CustomNoteCategory,
  type NoteFileCategory,
} from '../../_lib/workspace-content/types';

export function CategorySelect({
  value,
  onChange,
  disabled,
  accountId,
  accountSlug,
  customCategories = [],
  personalScope,
  onCustomCategoryCreated,
}: {
  value: NoteFileCategory;
  onChange: (value: NoteFileCategory) => void;
  disabled?: boolean;
  accountId?: string;
  accountSlug?: string;
  customCategories?: CustomNoteCategory[];
  personalScope?: boolean;
  onCustomCategoryCreated?: (category: CustomNoteCategory) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [pending, startTransition] = useTransition();

  const canAddCustom = Boolean(accountId && accountSlug);

  const addCustom = () => {
    if (!accountId || !accountSlug || !newLabel.trim()) return;

    startTransition(async () => {
      try {
        const result = await createNoteCategoryAction({
          accountId,
          accountSlug,
          label: newLabel.trim(),
          personalScope,
        });
        onCustomCategoryCreated?.({
          slug: result.slug,
          label: result.label,
        });
        onChange(result.slug);
        setNewLabel('');
        if (!result.existed) {
          toast.success('Category added');
        }
      } catch {
        toast.error('Could not add category');
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-[var(--workspace-shell-text-muted)]">Category</Label>
        <Select
          value={value}
          onValueChange={(v) => onChange(v as NoteFileCategory)}
          disabled={disabled || pending}
        >
          <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTE_FILE_CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {getNoteCategoryLabel(cat)}
              </SelectItem>
            ))}
            {customCategories.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {cat.label}
              </SelectItem>
            ))}
            {value &&
            !NOTE_FILE_CATEGORY_OPTIONS.includes(value) &&
            !customCategories.some((cat) => cat.slug === value) ? (
              <SelectItem value={value}>{getNoteCategoryLabel(value)}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>

      {canAddCustom ? (
        <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-3">
          <Label className="text-[var(--workspace-shell-text-muted)]">Custom category</Label>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Research"
              disabled={disabled || pending}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0 border-[color:var(--workspace-shell-border)]"
              disabled={disabled || pending || !newLabel.trim()}
              onClick={addCustom}
              aria-label="Add category"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CategoryBadge({
  category,
  customCategories = [],
}: {
  category: NoteFileCategory;
  customCategories?: CustomNoteCategory[];
}) {
  return (
    <span className="rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--workspace-shell-text-muted)]">
      {getNoteCategoryLabel(category, customCategories)}
    </span>
  );
}
