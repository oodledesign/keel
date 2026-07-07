import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { createDesktopConnectSession } from '~/lib/recorder/desktop-connect';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const metadata = {
  title: 'Connect Ozer Assistant',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    state?: string;
  }>;
};

function signInPath(state: string) {
  const next = `/connect/desktop-recorder?state=${encodeURIComponent(state)}`;
  return `${pathsConfig.auth.signIn}?next=${encodeURIComponent(next)}`;
}

export default async function DesktopRecorderConnectPage({ searchParams }: PageProps) {
  const { state: rawState } = await searchParams;
  const state = rawState?.trim() ?? '';

  if (!state) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 text-[var(--workspace-shell-text)] shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight">Connect Ozer Assistant</h1>
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            Open Ozer Assistant on your Mac and choose <strong className="text-[var(--workspace-shell-text)]">Sign in to Ozer</strong>{' '}
            to start the connection.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={pathsConfig.app.personalAccountRecorderSettings}>Open Ozer settings</Link>
          </Button>
        </div>
      </main>
    );
  }

  let user;
  try {
    user = await requireUserInServerComponent();
  } catch {
    redirect(signInPath(state));
  }

  let redirectURL: string;
  try {
    const session = await createDesktopConnectSession({
      userId: user.id,
      state,
    });
    redirectURL = session.redirectURL;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not connect Ozer Assistant.';
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 text-[var(--workspace-shell-text)] shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight">Connection failed</h1>
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">{message}</p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href={pathsConfig.app.personalAccountRecorderSettings}>Back to settings</Link>
          </Button>
        </div>
      </main>
    );
  }

  redirect(redirectURL);
}
