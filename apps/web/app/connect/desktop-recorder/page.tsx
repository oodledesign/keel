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
        <div className="rounded-2xl border border-white/10 bg-[#0F1B35] p-8 text-white shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight">Connect Ozer Assistant</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Open Ozer Assistant on your Mac and choose <strong className="text-white">Sign in to Ozer</strong>{' '}
            to start the connection.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={pathsConfig.app.personalAccountSettings}>Open Ozer settings</Link>
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
        <div className="rounded-2xl border border-white/10 bg-[#0F1B35] p-8 text-white shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight">Connection failed</h1>
          <p className="mt-3 text-sm text-zinc-400">{message}</p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href={pathsConfig.app.personalAccountSettings}>Back to settings</Link>
          </Button>
        </div>
      </main>
    );
  }

  redirect(redirectURL);
}
