'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ArrowRight, Loader2, Search, X } from 'lucide-react';

import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandRawInput,
  Command as CommandRoot,
} from '@kit/ui/command';
import { Dialog, DialogContent } from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type NavSearchItem,
  filterNavCatalog,
} from '~/lib/quick-action/filter-nav-catalog';

type QuickActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageContext: {
    accountId?: string;
    accountSlug?: string;
  };
};

const SEARCH_SHELL_CLASS =
  'max-w-xl gap-0 overflow-hidden rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] p-0 text-[var(--workspace-shell-text)] shadow-[0_16px_48px_rgba(0,0,0,0.45)] outline-none ring-0 focus:outline-none focus-visible:outline-none sm:rounded-[1.25rem]';

const SEARCH_OVERLAY_CLASS = 'bg-[#060a12]/50 backdrop-blur-[2px]';

export function QuickActionDialog(props: QuickActionDialogProps) {
  const { open, onOpenChange } = props;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<NavSearchItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    let cancelled = false;
    setCatalogLoading(true);

    void fetch('/api/quick-action/nav-catalog')
      .then(async (res) => {
        const body = (await res.json()) as {
          items?: NavSearchItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error ?? 'Failed to load pages');
        }
        if (!cancelled) {
          setCatalog(body.items ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Could not load search',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const matches = useMemo(
    () => (query.trim() ? filterNavCatalog(catalog, query, 12) : []),
    [catalog, query],
  );

  const goTo = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        overlayClassName={SEARCH_OVERLAY_CLASS}
        className={SEARCH_SHELL_CLASS}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <CommandRoot
          shouldFilter={false}
          className="flex flex-col overflow-hidden bg-transparent text-[var(--workspace-shell-text)]"
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Search
            </p>
            <button
              type="button"
              aria-label="Close search"
              tabIndex={-1}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--workspace-shell-text-muted)] transition-colors outline-none hover:bg-black/5 hover:text-[var(--workspace-shell-text)] focus:outline-none focus-visible:outline-none"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div
              className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white px-3 py-2.5 shadow-none"
              cmdk-input-wrapper=""
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
              <CommandRawInput
                ref={inputRef}
                autoFocus
                placeholder="Search pages…"
                value={query}
                onValueChange={setQuery}
                className={cn(
                  'flex h-8 w-full bg-transparent text-[15px] text-[var(--workspace-shell-text)] outline-none placeholder:text-[var(--workspace-shell-text-muted)]',
                  'ring-0 focus:outline-none focus-visible:outline-none',
                )}
              />
              <kbd className="hidden shrink-0 rounded border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text)]/55 sm:inline">
                ↵
              </kbd>
            </div>
          </div>

          <CommandList className="max-h-[min(60vh,420px)] border-t border-[color:var(--workspace-shell-border)] px-2 py-2">
            <CommandEmpty className="py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
              {catalogLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--ozer-accent)]" />
                  Loading…
                </span>
              ) : query.trim() ? (
                'No matching pages'
              ) : (
                'Type to search pages'
              )}
            </CommandEmpty>

            {matches.length > 0 ? (
              <CommandGroup className="p-0">
                {matches.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => goTo(item.href)}
                    className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 aria-selected:bg-[var(--workspace-shell-sidebar-accent)] aria-selected:text-[var(--workspace-shell-text)]"
                  >
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.label}
                      </p>
                      {item.category ? (
                        <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                          {item.category}
                        </p>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </CommandRoot>
      </DialogContent>
    </Dialog>
  );
}
