import Link from 'next/link';

import { CheckCircle2 } from 'lucide-react';

import { COMMERCIAL_TRUST_STRIP } from '~/lib/marketing/commercial-home-content';

export function CommercialTrustStrip() {
  const { items, agencySlot } = COMMERCIAL_TRUST_STRIP;

  return (
    <section
      className="w-full border-y border-[color:var(--workspace-shell-border)]/60 bg-[var(--ozer-cream-50)] py-8"
      aria-label="Trust and compliance"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center sm:gap-x-14">
          {items.map((item) => (
            <li key={item.title}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--workspace-shell-text)] transition-colors hover:text-[var(--ozer-accent)] sm:text-sm"
                >
                  <CheckCircle2 className="size-4 text-[var(--ozer-accent)]" />
                  <span>{item.title}</span>
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--workspace-shell-text)] sm:text-sm">
                  <CheckCircle2 className="size-4 text-[var(--ozer-accent)]" />
                  <span>{item.title}</span>
                </div>
              )}
            </li>
          ))}

          {agencySlot.enabled ? (
            <li>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--workspace-shell-text)] sm:text-sm">
                <CheckCircle2 className="size-4 text-[var(--ozer-accent)]" />
                <span>{agencySlot.text}</span>
              </div>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
