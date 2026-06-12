import Image from 'next/image';

import type { AgencyBranding } from '~/lib/agency-branding';

export function AgencyPortalShell({
  branding,
  children,
}: {
  branding: AgencyBranding;
  children: React.ReactNode;
}) {
  const primaryColour = branding.primary_colour?.trim() || '#2A9D8F';
  const brandLabel = branding.brand_name?.trim() || 'Portal';

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
      style={{ ['--primary-colour' as string]: primaryColour }}
    >
      <header className="border-b border-white/10 bg-zinc-950/90">
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
            <span className="text-lg font-semibold text-white">{brandLabel}</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
