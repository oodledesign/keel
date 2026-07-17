'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

const navItems = [
  { key: 'overview', label: 'Overview', pathKey: 'clientPortalHome' as const },
  { key: 'website', label: 'Website', pathKey: 'clientPortalWebsite' as const },
  { key: 'support', label: 'Support', pathKey: 'clientPortalSupport' as const },
  { key: 'billing', label: 'Billing', pathKey: 'clientPortalBilling' as const },
];

function createPortalPath(
  pathKey: keyof typeof pathsConfig.app,
  clientSlug: string,
) {
  return pathsConfig.app[pathKey].replace('[clientSlug]', clientSlug);
}

function isNavActive(pathname: string, href: string, key: string) {
  if (key === 'overview') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({
  clientSlug,
  orgName,
  userEmail,
  children,
}: {
  clientSlug: string;
  orgName: string;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const signOut = useSignOut();

  return (
    <div className="min-h-screen bg-slate-50 text-[var(--ozer-text-on-light)]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                Client portal
              </p>
              <h1 className="text-lg font-semibold text-[var(--ozer-text-on-light)]">
                {orgName}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {userEmail ? (
                <span className="hidden text-sm text-[var(--ozer-text-on-light-muted)] sm:inline">
                  {userEmail}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => signOut.mutateAsync()}
              >
                Sign out
              </Button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1">
            {navItems.map((item) => {
              const href = createPortalPath(item.pathKey, clientSlug);
              const active = isNavActive(pathname, href, item.key);

              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--ozer-accent-subtle)] text-[#1d6f65]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[var(--ozer-text-on-light)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
