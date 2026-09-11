import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  buildChromeExtensionRedirectURL,
  isAllowedChromeExtensionRedirectUri,
} from '~/lib/extension/chrome-connect';
import { createRecorderConnectCode } from '~/lib/recorder/desktop-connect';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const metadata = {
  title: 'Connect Ozer Chrome extension',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    state?: string;
    redirect_uri?: string;
  }>;
};

function signInPath(state: string, redirectUri?: string) {
  const params = new URLSearchParams({ state });
  if (redirectUri) params.set('redirect_uri', redirectUri);
  const next = `/connect/chrome-extension?${params.toString()}`;
  return `${pathsConfig.auth.signIn}?next=${encodeURIComponent(next)}`;
}

export default async function ChromeExtensionConnectPage({
  searchParams,
}: PageProps) {
  const { state: rawState, redirect_uri: rawRedirect } = await searchParams;
  const state = rawState?.trim() ?? '';
  const redirectUri = rawRedirect?.trim() ?? '';

  if (!state) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 text-[var(--workspace-shell-text)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
          <h1 className="text-2xl font-bold tracking-tight">
            Connect the Ozer extension
          </h1>
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            Open the Ozer Chrome extension and choose{' '}
            <strong className="text-[var(--workspace-shell-text)]">
              Connect workspace
            </strong>{' '}
            to start. You can also paste a personal API token from settings.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={pathsConfig.app.personalAccountRecorderSettings}>
              Open Ozer settings
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  let user;
  try {
    user = await requireUserInServerComponent();
  } catch {
    redirect(signInPath(state, redirectUri || undefined));
  }

  if (redirectUri && !isAllowedChromeExtensionRedirectUri(redirectUri)) {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 text-[var(--workspace-shell-text)]">
          <h1 className="text-2xl font-bold tracking-tight">
            Connection failed
          </h1>
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            That redirect is not a Chrome extension callback. Start connect from
            the extension.
          </p>
        </div>
      </main>
    );
  }

  let session: { code: string; state: string };
  try {
    session = await createRecorderConnectCode({
      userId: user.id,
      state,
      tokenName: 'Ozer Chrome extension',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not connect the Chrome extension.';
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 text-[var(--workspace-shell-text)]">
          <h1 className="text-2xl font-bold tracking-tight">
            Connection failed
          </h1>
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            {message}
          </p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href={pathsConfig.app.personalAccountRecorderSettings}>
              Back to settings
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  if (redirectUri) {
    redirect(
      buildChromeExtensionRedirectURL({
        redirectUri,
        code: session.code,
        state: session.state,
      }),
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 text-[var(--workspace-shell-text)]">
        <h1 className="text-2xl font-bold tracking-tight">Finish connecting</h1>
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          Paste this one-time code into the extension. It expires in two
          minutes.
        </p>
        <p className="mt-6 rounded-lg bg-[var(--ozer-surface-canvas)] px-3 py-3 font-mono text-sm break-all">
          {session.code}
        </p>
      </div>
    </main>
  );
}
