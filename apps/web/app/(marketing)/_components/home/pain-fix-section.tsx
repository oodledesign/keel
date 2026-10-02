import { ArrowRight } from 'lucide-react';

import {
  COMMERCIAL_BEFORE_AFTER,
  type CommercialBeforeAfterRow,
} from '~/lib/marketing/commercial-home-content';

export function PainFixSection() {
  const { eyebrow, heading, rows } = COMMERCIAL_BEFORE_AFTER;

  return (
    <section
      className="w-full bg-[var(--ozer-cream-50)] py-20 md:py-28"
      aria-labelledby="before-after-heading"
    >
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="mb-12 text-center md:mb-16">
          <p className="text-xs font-semibold tracking-wider text-[var(--workspace-shell-text-muted)] uppercase">
            {eyebrow}
          </p>
          <h2
            id="before-after-heading"
            className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] sm:text-4xl lg:text-5xl"
          >
            {heading}
          </h2>
        </div>

        <div className="space-y-4">
          {rows.map((row: CommercialBeforeAfterRow) => (
            <div
              key={row.before}
              className="grid grid-cols-1 items-center gap-2 rounded-2xl border border-[color:var(--workspace-shell-border)]/40 p-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:border-0 sm:p-0 md:gap-6"
            >
              {/* Left: Before (muted grey text, no card fill) */}
              <div className="flex items-center px-4 py-2 sm:justify-end sm:px-6 sm:py-3">
                <span className="text-sm font-medium text-[var(--workspace-shell-text-muted)] sm:text-right sm:text-base">
                  {row.before}
                </span>
              </div>

              {/* Middle: Arrow */}
              <div
                className="hidden justify-center text-[var(--workspace-shell-text-muted)]/50 sm:flex"
                aria-hidden="true"
              >
                <ArrowRight className="size-4" />
              </div>

              {/* Right: With Ozer (Wasabi-tinted pill card) */}
              <div className="flex items-center rounded-full border border-[#E9F056] bg-[#F7F9C8] px-5 py-3 text-[#2A1720] shadow-sm">
                <span className="text-sm font-semibold sm:text-base">
                  {row.withOzer}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
