import { ExternalLink } from 'lucide-react';

import {
  ADMIN_SUBPROCESSOR_CATEGORIES,
  ADMIN_SUBPROCESSORS,
  type AdminSubprocessor,
} from '../_lib/subprocessors';

function logoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function SubprocessorRow({ item }: { item: AdminSubprocessor }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="border-border hover:bg-muted/50 group flex items-center gap-4 border-b px-4 py-3 transition-colors last:border-b-0"
    >
      <span className="bg-background border-border flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote vendor favicons */}
        <img
          src={logoUrl(item.logoDomain)}
          alt=""
          width={28}
          height={28}
          className="size-7 object-contain"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-foreground flex flex-wrap items-center gap-2 font-medium">
          {item.name}
          {item.isSubprocessor ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Sub-processor
            </span>
          ) : (
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Integration
            </span>
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-sm">
          {item.purpose}
        </span>
        <span className="text-muted-foreground/80 mt-1 block truncate text-xs">
          {item.href.replace(/^https?:\/\//, '')}
        </span>
      </span>

      <ExternalLink className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
    </a>
  );
}

export function AdminSubprocessorsList() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground max-w-2xl text-sm">
        Quick links to vendors Ozer relies on. Formal GDPR sub-processors match
        the Trust Centre list; integrations are customer-connected or Rankly
        data providers.
      </p>

      {ADMIN_SUBPROCESSOR_CATEGORIES.map((category) => {
        const items = ADMIN_SUBPROCESSORS.filter(
          (row) => row.category === category,
        );
        if (items.length === 0) return null;

        return (
          <section key={category} className="space-y-3">
            <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
              {category}
            </h2>
            <div className="border-border bg-card overflow-hidden rounded-xl border">
              {items.map((item) => (
                <SubprocessorRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
