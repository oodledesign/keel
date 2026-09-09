import Link from 'next/link';
import { redirect } from 'next/navigation';

import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { getOAuthDecisionRedirectUrl } from '~/lib/oauth/decision';

import { OAuthConsentCard } from './_components/oauth-consent-card';

export const metadata = {
  title: 'Authorise application',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    authorization_id?: string;
    error?: string;
  }>;
};

function consentReturnPath(authorizationId: string) {
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

function signInPath(authorizationId: string) {
  return `${pathsConfig.auth.signIn}?next=${encodeURIComponent(consentReturnPath(authorizationId))}`;
}

function verifyMfaPath(authorizationId: string) {
  return `${pathsConfig.auth.verifyMfa}?next=${encodeURIComponent(consentReturnPath(authorizationId))}`;
}

function ConsentError({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center bg-[var(--workspace-shell-canvas)] px-4 py-16">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-[var(--workspace-shell-text)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
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

function consentErrorCopy(error: string | undefined) {
  if (error === 'csrf') {
    return {
      title: 'Could not confirm this request',
      message:
        'This approval request did not come from Ozer. Start the connection again from ChatGPT or Claude.',
    };
  }

  if (error === 'decision_failed' || error === 'expired') {
    return {
      title: 'Authorisation could not be completed',
      message:
        'This authorisation request expired or was already used. Close this window and start the connection again from ChatGPT or Claude.',
    };
  }

  return null;
}

export default async function OAuthConsentPage({ searchParams }: PageProps) {
  const { authorization_id: rawAuthorizationId, error: rawError } =
    await searchParams;
  const authorizationId = rawAuthorizationId?.trim() ?? '';
  const errorCopy = consentErrorCopy(rawError?.trim());

  if (errorCopy && !authorizationId) {
    return <ConsentError title={errorCopy.title} message={errorCopy.message} />;
  }

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

  let requiresMfa = false;

  try {
    requiresMfa = await checkRequiresMultiFactorAuthentication(supabase);
  } catch (error) {
    console.error('[oauth/consent] MFA check failed', {
      name: error instanceof Error ? error.name : null,
    });
    redirect(verifyMfaPath(authorizationId));
  }

  if (requiresMfa) {
    redirect(verifyMfaPath(authorizationId));
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
    const redirectUrl = getOAuthDecisionRedirectUrl(authDetails);

    if (redirectUrl) {
      redirect(redirectUrl);
    }

    return (
      <ConsentError
        title="Authorisation request unavailable"
        message="We could not finish this authorisation request. Start the connection again from ChatGPT or Claude."
      />
    );
  }

  const scopes = authDetails.scope
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center bg-[var(--workspace-shell-canvas)] px-4 py-16">
      {errorCopy ? (
        <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
          {errorCopy.message}
        </p>
      ) : null}
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
