import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

import { OAuthConsentCard } from './_components/oauth-consent-card';

export const metadata = {
  title: 'Authorise application',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    authorization_id?: string;
  }>;
};

function consentReturnPath(authorizationId: string) {
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

function signInPath(authorizationId: string) {
  return `${pathsConfig.auth.signIn}?next=${encodeURIComponent(consentReturnPath(authorizationId))}`;
}

function ConsentError({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center bg-[var(--workspace-shell-canvas)] px-4 py-16">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-[var(--workspace-shell-text)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          {message}
        </p>
        <Button
          asChild
          className="mt-6 w-full bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
        >
          <Link href={pathsConfig.app.home}>Back to Ozer</Link>
        </Button>
      </div>
    </main>
  );
}

export default async function OAuthConsentPage({ searchParams }: PageProps) {
  const { authorization_id: rawAuthorizationId } = await searchParams;
  const authorizationId = rawAuthorizationId?.trim() ?? '';

  if (!authorizationId) {
    return (
      <ConsentError
        title="Missing authorisation request"
        message="This consent link is incomplete. Start the connection again from your application."
      />
    );
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPath(authorizationId));
  }

  const { data: authDetails, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error) {
    return (
      <ConsentError
        title="Authorisation request unavailable"
        message={
          error.message ||
          'This authorisation request may have expired. Start the connection again.'
        }
      />
    );
  }

  if (!authDetails) {
    return (
      <ConsentError
        title="Authorisation request unavailable"
        message="We could not load this authorisation request. Start the connection again."
      />
    );
  }

  if (!('authorization_id' in authDetails)) {
    redirect(authDetails.redirect_url);
  }

  const scopes = authDetails.scope
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center bg-[var(--workspace-shell-canvas)] px-4 py-16">
      <OAuthConsentCard
        authorizationId={authDetails.authorization_id}
        clientName={authDetails.client.name}
        clientUri={authDetails.client.uri}
        redirectUri={authDetails.redirect_uri}
        scopes={scopes}
        userEmail={authDetails.user.email}
      />
    </main>
  );
}
