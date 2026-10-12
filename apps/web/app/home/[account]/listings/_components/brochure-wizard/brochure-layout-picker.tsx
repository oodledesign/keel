'use client';

import { useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import type {
  BrochureLayoutId,
  BrochureOrientation,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import {
  BROCHURE_LAYOUT_OPTIONS,
  brochureLayoutLabel,
} from '~/lib/commercial/brochure-pdf/build-brochure-document';

import { BrochureLayoutThumb } from './brochure-layout-thumb';

export function BrochureLayoutPicker({
  id,
  value,
  layouts,
  orientation,
  onChange,
}: {
  id?: string;
  value: BrochureLayoutId;
  layouts: readonly BrochureLayoutId[];
  orientation: BrochureOrientation;
  onChange: (layoutId: BrochureLayoutId) => void;
}) {
  const [open, setOpen] = useState(false);
  const landscape = orientation === 'landscape';
  const options = BROCHURE_LAYOUT_OPTIONS.filter((opt) =>
    layouts.includes(opt.id),
  );

  return (
    // Modal so the picker scrolls when it opens over the wizard dialog, which
    // otherwise blocks scrolling outside itself.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="border-input flex h-8 w-60 items-center gap-2 rounded-md border bg-transparent pr-2 pl-1.5 text-xs shadow-2xs outline-hidden focus-visible:border-[var(--ozer-accent)]/50"
        >
          <BrochureLayoutThumb
            layoutId={value}
            orientation={orientation}
            className={landscape ? 'h-5' : 'h-6'}
          />
          <span className="min-w-0 flex-1 truncate text-left">
            {brochureLayoutLabel(value)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(40rem,var(--radix-popover-content-available-height))] w-[26rem] overflow-y-auto overscroll-contain p-3"
      >
        <div
          className={cn(
            'grid gap-2',
            landscape ? 'grid-cols-3' : 'grid-cols-4',
          )}
        >
          {options.map((opt) => {
            const selected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.description}
                aria-pressed={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onChange(opt.id);
                }}
                className={cn(
                  'group flex flex-col gap-1 rounded-md p-1 text-left outline-hidden transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]/50',
                  selected && 'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                <BrochureLayoutThumb
                  layoutId={opt.id}
                  orientation={orientation}
                  className={cn(
                    'w-full',
                    selected &&
                      'border-[var(--ozer-accent)] ring-1 ring-[var(--ozer-accent)]',
                  )}
                />
                <span
                  className={cn(
                    'line-clamp-2 text-[11px] leading-tight',
                    selected
                      ? 'font-medium text-[var(--workspace-shell-text)]'
                      : 'text-[var(--workspace-shell-text-muted)] group-hover:text-[var(--workspace-shell-text)]',
                  )}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
