'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ArrowRight, Clock3, Loader2, Search, X } from 'lucide-react';

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
import {
  getCachedNavCatalog,
  prefetchNavCatalog,
} from '~/lib/quick-action/nav-catalog-cache';
import {
  type SearchHistoryItem,
  loadSearchHistory,
  pushSearchHistory,
} from '~/lib/quick-action/search-history';

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

type VisualViewportBox = {
  offsetTop: number;
  height: number;
};

function readVisualViewport(): VisualViewportBox {
  if (typeof window === 'undefined') {
    return { offsetTop: 0, height: 800 };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { offsetTop: 0, height: window.innerHeight };
  }
  return { offsetTop: vv.offsetTop, height: vv.height };
}

export function QuickActionDialog(props: QuickActionDialogProps) {
  const { open, onOpenChange } = props;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<NavSearchItem[]>(
    () => getCachedNavCatalog() ?? [],
  );
  const [catalogLoading, setCatalogLoading] = useState(
    () => !getCachedNavCatalog(),
  );
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [viewport, setViewport] =
    useState<VisualViewportBox>(readVisualViewport);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    setHistory(loadSearchHistory());

    const cached = getCachedNavCatalog();
    if (cached) {
      setCatalog(cached);
      setCatalogLoading(false);
      return;
    }

    let cancelled = false;
    setCatalogLoading(true);

    void prefetchNavCatalog()
      .then((items) => {
        if (!cancelled) {
          setCatalog(items);
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

  // Keep the dialog centred in the *visible* viewport so the software keyboard
  // does not leave empty space above or clip the modal.
  useEffect(() => {
    if (!open) return;

    const update = () => setViewport(readVisualViewport());
    update();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const trimmedQuery = query.trim();
  const matches = useMemo(
    () =>
      trimmedQuery
        ? filterNavCatalog(catalog, trimmedQuery, 16, {
            preferAccountSlug: props.pageContext.accountSlug,
          })
        : [],
    [catalog, props.pageContext.accountSlug, trimmedQuery],
  );

  const goTo = useCallback(
    (item: Pick<NavSearchItem, 'id' | 'label' | 'href' | 'category'>) => {
      setHistory(pushSearchHistory(item));
      onOpenChange(false);
      router.push(item.href);
    },
    [onOpenChange, router],
  );

  const showHistory = !trimmedQuery && history.length > 0;
  const showTypedLoading = Boolean(trimmedQuery) && catalogLoading;
  const showNoMatches =
    Boolean(trimmedQuery) && !catalogLoading && matches.length === 0;
  const showTypeHint = !trimmedQuery && history.length === 0;

  const dialogTop = viewport.offsetTop + viewport.height / 2;
  const listMaxHeight = Math.min(420, Math.max(160, viewport.height * 0.45));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        overlayClassName={SEARCH_OVERLAY_CLASS}
        className={SEARCH_SHELL_CLASS}
        style={{
          top: dialogTop,
          maxHeight: Math.max(240, viewport.height - 24),
        }}
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
          <div className="relative px-4 pt-4 pb-3">
            <button
              type="button"
              aria-label="Close search"
              tabIndex={-1}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--workspace-shell-text-muted)] transition-colors outline-none hover:bg-black/5 hover:text-[var(--workspace-shell-text)] focus:outline-none focus-visible:outline-none"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white py-2.5 pr-3 pl-3 shadow-none"
              cmdk-input-wrapper=""
            >
              <Search className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
              <CommandRawInput
                ref={inputRef}
                autoFocus
                placeholder="Search pages, clients, projects…"
                value={query}
                onValueChange={setQuery}
                className={cn(
                  'workspace-search-input flex h-8 w-full bg-transparent text-[15px] text-[var(--workspace-shell-text)] outline-none placeholder:text-[var(--workspace-shell-text-muted)]',
                  'border-0 shadow-none ring-0 focus:border-0 focus:shadow-none focus:ring-0 focus:outline-none focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none',
                )}
              />
              <kbd className="hidden shrink-0 rounded border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text)]/55 sm:inline">
                ↵
              </kbd>
            </div>
          </div>

          <CommandList
            className="border-t border-[color:var(--workspace-shell-border)] px-2 py-2"
            style={{ maxHeight: listMaxHeight }}
          >
            {showTypeHint || showTypedLoading || showNoMatches ? (
              <CommandEmpty className="py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
                {showTypedLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--ozer-accent)]" />
                    Searching…
                  </span>
                ) : showNoMatches ? (
                  'No matching pages or records'
                ) : (
                  'Type to search pages, clients, projects…'
                )}
              </CommandEmpty>
            ) : null}

            {showHistory ? (
              <CommandGroup
                heading="Recent"
                className="p-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--workspace-shell-text-muted)]"
              >
                {history.map((item) => (
                  <CommandItem
                    key={`history-${item.id}`}
                    value={`history-${item.id}`}
                    onSelect={() => goTo(item)}
                    className="cursor-pointer gap-3 rounded-lg px-3 py-2.5 aria-selected:bg-[var(--workspace-shell-sidebar-accent)] aria-selected:text-[var(--workspace-shell-text)]"
                  >
                    <Clock3 className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
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

            {matches.length > 0 ? (
              <CommandGroup className="p-0">
                {matches.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => goTo(item)}
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
