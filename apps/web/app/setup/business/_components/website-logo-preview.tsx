'use client';

import { useEffect, useState } from 'react';

import { cn } from '@kit/ui/utils';

import { normalizeDomainInput } from '~/lib/clients/client-logo-domain';
import { googleFaviconUrl } from '~/lib/clients/client-logo-icons';

const DEBOUNCE_MS = 450;

export function WebsiteLogoPreview(props: {
  website: string;
  label?: string;
  fallbackLetter?: string;
}) {
  const domain = normalizeDomainInput(props.website);
  const [readyDomain, setReadyDomain] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const delay = domain ? DEBOUNCE_MS : 0;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setReadyDomain(domain);
      setFailed(false);
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [domain]);

  if (!props.website.trim()) {
    return null;
  }

  const letter =
    props.fallbackLetter?.trim().charAt(0).toUpperCase() ||
    domain?.charAt(0).toUpperCase() ||
    '?';
  const loading = Boolean(domain && readyDomain !== domain);
  const previewSrc =
    readyDomain && readyDomain === domain && !failed
      ? googleFaviconUrl(readyDomain, 128)
      : null;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
          loading && 'animate-pulse',
        )}
        aria-hidden
      >
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-sm font-semibold text-[var(--workspace-shell-text-muted)]">
            {letter}
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        {loading
          ? 'Fetching logo…'
          : previewSrc
            ? (props.label ?? 'Logo from website')
            : 'No logo yet — you can add one later'}
      </p>
    </div>
  );
}
