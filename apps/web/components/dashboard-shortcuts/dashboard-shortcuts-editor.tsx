'use client';

import { useMemo, useState, useTransition } from 'react';

import { GripVertical, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import { searchShortcutCatalogAction } from '~/lib/dashboard-shortcuts/dashboard-shortcuts.actions';
import type { ShortcutCatalogItem, StoredShortcut } from '~/lib/dashboard-shortcuts/types';
import { catalogItemKey } from '~/lib/dashboard-shortcuts/types';

type Props = {
  scope: 'personal' | 'workspace';
  accountSlug?: string;
  shortcuts: StoredShortcut[];
  onChange: (shortcuts: StoredShortcut[]) => void;
  maxShortcuts?: number;
  helperText?: string;
  emptyText?: string;
};

export function DashboardShortcutsEditor({
  scope,
  accountSlug,
  shortcuts,
  onChange,
  maxShortcuts = 12,
  helperText,
  emptyText = 'No shortcuts configured yet.',
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShortcutCatalogItem[]>([]);
  const [pending, startTransition] = useTransition();

  const selectedKeys = useMemo(
    () => new Set(shortcuts.map((s) => catalogItemKey(s))),
    [shortcuts],
  );

  const runSearch = (value: string) => {
    setQuery(value);
    startTransition(async () => {
      const res = await searchShortcutCatalogAction({
        scope,
        accountSlug,
        query: value,
      });
      if (res.success) {
        setResults(res.items.slice(0, 40));
      }
    });
  };

  const openPicker = () => {
    setPickerOpen(true);
    runSearch('');
  };

  const addItem = (item: ShortcutCatalogItem) => {
    const key = catalogItemKey(item);
    if (selectedKeys.has(key) || shortcuts.length >= maxShortcuts) return;

    onChange([
      ...shortcuts,
      {
        id: crypto.randomUUID(),
        catalogId: item.catalogId,
        params: item.params,
        label: item.label,
      },
    ]);
    setPickerOpen(false);
  };

  const removeAt = (index: number) => {
    onChange(shortcuts.filter((_, i) => i !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...shortcuts];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          {helperText ?? `Pin up to ${maxShortcuts} quick links on your dashboard.`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/10 bg-transparent text-zinc-200"
          onClick={openPicker}
          disabled={shortcuts.length >= maxShortcuts}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add shortcut
        </Button>
      </div>

      {shortcuts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <li
              key={shortcut.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {shortcut.label || shortcut.catalogId}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {shortcut.catalogId}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-zinc-500 hover:text-rose-400"
                onClick={() => removeAt(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85vh] border-white/10 bg-[#0F1B35] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a shortcut</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Search pages, workspaces, Rankly projects…"
              className="border-white/10 bg-[var(--workspace-shell-panel)] pl-9 text-white"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-white/10">
            {pending && results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">No matches.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {results.map((item) => {
                  const key = catalogItemKey(item);
                  const disabled = selectedKeys.has(key);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => addItem(item)}
                        className={cn(
                          'flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-white/[0.03]',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className="text-sm font-medium text-white">
                          {item.label}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {item.category}
                          {item.description ? ` · ${item.description}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
