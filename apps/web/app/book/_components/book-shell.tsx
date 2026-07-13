import Link from 'next/link';

import { ProfileAvatar } from '@kit/ui/profile-avatar';

type Props = {
  title: string;
  description?: string | null;
  brandColour?: string | null;
  logoUrl?: string | null;
  hostName?: string | null;
  hostPictureUrl?: string | null;
  children: React.ReactNode;
  footerNote?: string;
};

export function BookShell({
  title,
  description,
  brandColour,
  logoUrl,
  hostName,
  hostPictureUrl,
  children,
  footerNote,
}: Props) {
  const accent = brandColour || '#FF5C34';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <div
                className="h-1.5 w-16 rounded-full"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
            )}
          </div>
          {hostName || hostPictureUrl ? (
            <div className="flex shrink-0 items-center gap-2">
              {hostName ? (
                <span className="hidden text-sm text-[color:var(--ozer-text-muted,#6B5B63)] sm:inline">
                  {hostName}
                </span>
              ) : null}
              <ProfileAvatar
                displayName={hostName ?? 'Host'}
                pictureUrl={hostPictureUrl}
                className="h-10 w-10"
              />
            </div>
          ) : null}
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-base text-[color:var(--ozer-text-muted,#6B5B63)]">
            {description}
          </p>
        ) : null}
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-12 border-t border-black/10 pt-6 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
        <p>{footerNote ?? 'Powered by Ozer Scheduling'}</p>
        <p className="mt-1">
          <Link
            href="https://ozer.so"
            className="underline-offset-2 hover:underline"
          >
            ozer.so
          </Link>
        </p>
      </footer>
    </main>
  );
}
