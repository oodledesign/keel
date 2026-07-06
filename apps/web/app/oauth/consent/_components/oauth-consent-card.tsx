'use client';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

type Props = {
  authorizationId: string;
  clientName: string;
  clientUri?: string;
  redirectUri: string;
  scopes: string[];
  userEmail: string;
};

function formatScope(scope: string): string {
  const labels: Record<string, string> = {
    openid: 'Sign-in identity',
    profile: 'Profile',
    email: 'Email address',
    phone: 'Phone number',
  };

  return labels[scope] ?? scope;
}

export function OAuthConsentCard({
  authorizationId,
  clientName,
  clientUri,
  redirectUri,
  scopes,
  userEmail,
}: Props) {
  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ozer-accent)] text-sm font-bold text-white">
          O
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
            Authorise access
          </p>
          <h1 className="text-xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
            Connect to Ozer
          </h1>
        </div>
      </div>

      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Signed in as{' '}
        <span className="font-medium text-[var(--workspace-shell-text)]">
          {userEmail}
        </span>
      </p>

      <div className="mt-6 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          <span className="font-semibold text-[var(--workspace-shell-text)]">
            {clientName}
          </span>{' '}
          is requesting access to your Ozer account.
        </p>
        {clientUri ? (
          <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
            Application:{' '}
            <span className="break-all text-[var(--workspace-shell-text)]">
              {clientUri}
            </span>
          </p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
          Redirect URI:{' '}
          <span className="break-all text-[var(--workspace-shell-text)]">
            {redirectUri}
          </span>
        </p>
      </div>

      {scopes.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
            Requested permissions
          </p>
          <div className="flex flex-wrap gap-2">
            {scopes.map((scope) => (
              <Badge
                key={scope}
                variant="outline"
                className="rounded-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-1 text-xs font-medium text-[var(--workspace-shell-text)]"
              >
                {formatScope(scope)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
        Only approve if you trust this application. You can revoke access later
        from your account settings.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <form action="/api/oauth/decision" method="post" className="flex-1">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <input type="hidden" name="decision" value="approve" />
          <Button type="submit" className="w-full bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]">
            Approve
          </Button>
        </form>
        <form action="/api/oauth/decision" method="post" className="flex-1">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <input type="hidden" name="decision" value="deny" />
          <Button type="submit" variant="outline" className="w-full">
            Deny
          </Button>
        </form>
      </div>
    </div>
  );
}
