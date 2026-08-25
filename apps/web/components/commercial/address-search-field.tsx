'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Loader2, MapPin, Search } from 'lucide-react';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';

export type AddressSearchSelection = AddressSuggestion;

type AddressSearchFieldProps = {
  onSelect: (suggestion: AddressSearchSelection) => void;
  className?: string;
  inputClassName?: string;
  label?: string;
  placeholder?: string;
};

export function AddressSearchField({
  onSelect,
  className,
  inputClassName,
  label = 'Find address',
  placeholder = 'Start typing a UK address, postcode, or place…',
}: AddressSearchFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const res = await fetch(
          `/api/commercial/address-suggest?q=${encodeURIComponent(trimmed)}&limit=6`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setSuggestions([]);
          setUnavailable(true);
          return;
        }
        const body = (await res.json()) as {
          suggestions?: AddressSuggestion[];
        };
        const next = body.suggestions ?? [];
        setSuggestions(next);
        setUnavailable(false);
        setOpen(true);
        setActiveIndex(next.length ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSuggestions([]);
        setUnavailable(true);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function applySuggestion(suggestion: AddressSuggestion) {
    onSelect(suggestion);
    setQuery(suggestion.label);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapRef} className={cn('relative space-y-1.5', className)}>
      <Label className="text-[var(--workspace-shell-text)]/70">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text)]/35" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(
                (i) => (i - 1 + suggestions.length) % suggestions.length,
              );
            } else if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault();
              const hit = suggestions[activeIndex];
              if (hit) applySuggestion(hit);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          data-test="address-search-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={cn('pr-9 pl-9', inputClassName)}
        />
        {loading ? (
          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--workspace-shell-text)]/40" />
        ) : null}
      </div>

      {open && query.trim().length >= 3 ? (
        <ul
          id={listId}
          role="listbox"
          data-test="address-search-suggestions"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] py-1 shadow-lg"
        >
          {suggestions.length === 0 && !loading ? (
            <li className="px-3 py-2 text-sm text-[var(--workspace-shell-text)]/50">
              {unavailable
                ? 'Address search unavailable — enter details manually.'
                : 'No matches. Try a fuller address or postcode.'}
            </li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                    index === activeIndex &&
                      'bg-[var(--workspace-shell-sidebar-accent)]',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => applySuggestion(suggestion)}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text)]/40" />
                  <span className="min-w-0 leading-snug">
                    {suggestion.label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <p className="text-xs text-[var(--workspace-shell-text)]/45">
        Select a result to fill address, postcode and map pin. You can still
        edit the fields below.
      </p>
    </div>
  );
}
