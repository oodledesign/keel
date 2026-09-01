import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { resolvePostAuthLandingPath } from '~/lib/dashboard-shortcuts/resolve-post-auth-landing';
import { attributeReferralAtSignup } from '~/lib/rewards/attribute-referral-at-signup';

const HOME = pathsConfig.app.home;

async function landingAfterAuth(
  client: ReturnType<typeof getSupabaseServerClient>,
  nextPath: string | null | undefined,
) {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return nextPath ?? HOME;

  // OAuth signups skip /api/auth/sign-up — notify ops on first callback
  // for a brand-new OAuth user (password signups already notified at signup).
  // Keep the window tight (~15s) so a retried callback does not double-email.
  try {
    const createdAtMs = user.created_at
      ? new Date(user.created_at).getTime()
      : 0;
    const isBrandNew = createdAtMs > 0 && Date.now() - createdAtMs < 15_000;
    const hasOAuthIdentity = (user.identities ?? []).some(
      (identity) => identity.provider && identity.provider !== 'email',
    );

    if (isBrandNew && hasOAuthIdentity && user.email) {
      void import('~/lib/admin/platform-lifecycle-notifications')
        .then(({ notifyPlatformNewSignup }) =>
          notifyPlatformNewSignup({
            email: user.email!,
            userId: user.id,
            source: 'oauth',
          }),
        )
        .catch((err) => {
          console.error(
            '[auth/callback] Failed to queue OAuth signup notification:',
            err instanceof Error ? err.message : err,
          );
        });

      try {
        const admin = getSupabaseServerAdminClient();
        void attributeReferralAtSignup({
          referredUserId: user.id,
          admin,
        }).catch((err) => {
          console.error(
            '[auth/callback] Referral attribution failed:',
            err instanceof Error ? err.message : err,
          );
        });
      } catch (err) {
        console.error(
          '[auth/callback] Referral attribution failed:',
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.error(
      '[auth/callback] Signup notification check failed:',
      err instanceof Error ? err.message : err,
    );
  }

  return resolvePostAuthLandingPath(client, user.id, nextPath, HOME);
}

export async function HEAD() {
  // Email scanners prefetch with HEAD. Never verify OTPs here — Next would
  // otherwise run GET and burn one-time recovery/magic links.
  return new Response(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const service = createAuthCallbackService(client);
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');

  const recoveryDestination = pathsConfig.auth.passwordUpdate;
  const isRecovery = type === 'recovery' || nextParam === recoveryDestination;

  const baseParams = {
    joinTeamPath: pathsConfig.app.joinTeam,
    redirectPath: isRecovery ? recoveryDestination : HOME,
  };

  if (tokenHash && type) {
    const redirectUrl = await service.verifyTokenHash(request, baseParams);
    if (isRecovery && !redirectUrl.searchParams.has('error')) {
      redirectUrl.pathname = recoveryDestination;
      redirectUrl.search = '';
      return redirect(`${redirectUrl.pathname}`);
    }
    const nextFromVerify = `${redirectUrl.pathname}${redirectUrl.search}`;
    return redirect(await landingAfterAuth(client, nextFromVerify));
  }

  if (code) {
    const { nextPath } = await service.exchangeCodeForSession(
      request,
      baseParams,
    );
    if (isRecovery && !nextPath.includes('/auth/callback/error')) {
      return redirect(recoveryDestination);
    }
    return redirect(await landingAfterAuth(client, nextPath));
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in...</title></head>
<body>
  <p>Signing you in...</p>
  <script>
    (function() {
      var hash = window.location.hash.slice(1);
      var params = new URLSearchParams(hash);
      var query = new URLSearchParams(window.location.search);
      var tokenHash = params.get('token_hash');
      var type = params.get('type');
      var next = query.get('next') || '${HOME}';
      if (type === 'recovery') {
        next = '${recoveryDestination}';
      }
      if (tokenHash && type) {
        fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash, type: type })
        })
          .then(function(r) {
            if (r.ok) window.location.replace(next);
            else r.json().then(function(d) {
              window.location.replace('/auth/callback/error?error=' + encodeURIComponent(d.error || 'Verification failed'));
            });
          })
          .catch(function() {
            window.location.replace('/auth/callback/error?error=Verification+failed');
          });
      } else {
        window.location.replace(next);
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
