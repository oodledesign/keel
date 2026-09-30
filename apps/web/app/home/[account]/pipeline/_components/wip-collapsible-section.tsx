'use client';

import { type ReactNode, useId, useState } from 'react';

import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * A titled, bordered section that can be collapsed.
 *
 * The body stays mounted while collapsed (hidden, not removed) so form fields
 * inside it are still submitted with the surrounding form. Set `lazy` for
 * bodies that fetch data on mount: they mount on first open instead.
 */
export function WipCollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  lazy = false,
  children,
  dataTest,
}: {
  title: string;
  /** Short hint beside the title, most useful while collapsed. */
  summary?: string | null;
  defaultOpen?: boolean;
  lazy?: boolean;
  children: ReactNode;
  dataTest?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);
  const bodyId = useId();
  const titleId = useId();
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl border border-[color:var(--workspace-shell-border)]"
      data-test={dataTest}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOpen((prev) => !prev);
          setEverOpened(true);
        }}
      >
        <Chevron
          className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]"
          aria-hidden
        />
        <span
          id={titleId}
          className="text-sm font-medium text-[var(--workspace-shell-text)]"
        >
          {title}
        </span>
        {summary ? (
          <span className="ml-auto truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
            {summary}
          </span>
        ) : null}
      </button>
      <div id={bodyId} hidden={!open} className="px-3 pb-3">
        {lazy && !everOpened ? null : children}
      </div>
    </section>
  );
}
