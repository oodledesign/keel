'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ArrowRight, Search, X } from 'lucide-react';

import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import {
  type DisposalSearchHit,
  searchDisposalPages,
} from '../_lib/disposal-page-search';

export function ListingPageSearch({
  listingBasePath,
  className,
}: {
  listingBasePath: string;
  className?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchDisposalPages(query), [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const goTo = (hit: DisposalSearchHit) => {
    const path = `${listingBasePath}${hit.href}`;
    const href = hit.hash ? `${path}#${hit.hash}` : path;
    setOpen(false);
    setQuery('');
    router.push(href);
    if (hit.hash) {
      // After client navigation, scroll once the target exists.
      window.setTimeout(() => {
        document.getElementById(hit.hash!)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 320);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full max-w-md', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text)]/40" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open || results.length === 0) {
              if (event.key === 'Escape') {
                setOpen(false);
                setQuery('');
              }
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) =>
                index + 1 >= results.length ? 0 : index + 1,
              );
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) =>
                index - 1 < 0 ? results.length - 1 : index - 1,
              );
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const hit = results[activeIndex];
              if (hit) goTo(hit);
            } else if (event.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
          }}
          placeholder="Find on this disposal… e.g. parking"
          className="h-9 bg-[var(--workspace-shell-panel)] pr-9 pl-9 text-sm"
          aria-label="Search disposal pages and sections"
          aria-expanded={open && query.trim().length > 0}
          aria-controls="disposal-page-search-results"
          role="combobox"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--workspace-shell-text)]/45 hover:text-[var(--workspace-shell-text)]"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && query.trim().length > 0 ? (
        <ul
          id="disposal-page-search-results"
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[var(--workspace-shell-text)]/50">
              No matching sections. Try “parking”, “landlord”, or “EPC”.
            </li>
          ) : (
            results.map((hit, index) => (
              <li
                key={hit.id}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    index === activeIndex
                      ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                      : 'text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo(hit)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{hit.title}</p>
                    <p className="truncate text-xs text-[var(--workspace-shell-text)]/50">
                      {[hit.page, hit.context].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
