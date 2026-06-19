'use client';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

const SECTIONS = [
  { id: 'compliance', label: 'Compliance' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'data-flow', label: 'Data flow' },
  { id: 'application-security', label: 'Application security' },
  { id: 'business-continuity', label: 'Business continuity' },
  { id: 'vulnerability-disclosure', label: 'Vulnerability disclosure' },
  { id: 'contact', label: 'Contact' },
] as const;

export function TrustCenterNav({ className }: { className?: string }) {
  return (
    <nav className={cn('flex flex-col gap-1', className)} aria-label="Trust Center sections">
      {SECTIONS.map((section) => (
        <Link
          key={section.id}
          href={`#${section.id}`}
          className={cn(
            'text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors',
            'hover:bg-muted/60',
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}

export function TrustCenterMobileNav() {
  return (
    <nav
      className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 -mx-4 border-b px-4 py-3 backdrop-blur lg:hidden"
      aria-label="Trust Center sections"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((section) => (
          <Link
            key={section.id}
            href={`#${section.id}`}
            className="border-border bg-muted/40 text-foreground shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap"
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
