import Image from 'next/image';

import type { AgencyBranding } from '~/lib/agency-branding';

export function AgencyPortalShell({
  branding,
  children,
}: {
  branding: AgencyBranding;
  children: React.ReactNode;
}) {
  const primaryColour = branding.primary_colour?.trim() || '#FF5C34';
  const brandLabel = branding.brand_name?.trim() || 'Portal';

  return (
    <div
      className="min-h-screen bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
      style={{ ['--primary-colour' as string]: primaryColour }}
    >
      <header className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/90">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          {branding.logo_url ? (
            <Image
              src={branding.logo_url}
              alt={brandLabel}
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          ) : (
            <span className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              {brandLabel}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
