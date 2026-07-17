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
import { catalogItemHref } from '~/lib/dashboard-shortcuts/resolve-href';
import type {
  ShortcutCatalogItem,
  StoredShortcut,
} from '~/lib/dashboard-shortcuts/types';
import { catalogItemKey } from '~/lib/dashboard-shortcuts/types';
import { resolveNavIconKey } from '~/lib/mobile-nav/nav-icon-keys';

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

    const href = catalogItemHref(item);
    const iconKey = href ? resolveNavIconKey(href) : undefined;

    onChange([
      ...shortcuts,
      {
        id: crypto.randomUUID(),
        catalogId: item.catalogId,
        params: item.params,
        label: item.label,
        iconKey,
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
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          {helperText ??
            `Pin up to ${maxShortcuts} quick links on your dashboard.`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)]"
          onClick={openPicker}
          disabled={shortcuts.length >= maxShortcuts}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add shortcut
        </Button>
      </div>

      {shortcuts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <li
              key={shortcut.id}
              className="flex items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text-muted)] disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {shortcut.label || shortcut.catalogId}
                </p>
                <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                  {shortcut.catalogId}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-[var(--workspace-shell-text-muted)] hover:text-rose-400"
                onClick={() => removeAt(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85vh] border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a shortcut</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Search pages, workspaces, Rankly projects…"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] pl-9 text-[var(--workspace-shell-text)]"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
            {pending && results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)]">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)]">
                No matches.
              </p>
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
                          'flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className="text-sm font-medium text-[var(--workspace-shell-text)]">
                          {item.label}
                        </span>
                        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
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
