import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { resolvePostAuthLandingPath } from '~/lib/dashboard-shortcuts/resolve-post-auth-landing';

const HOME = pathsConfig.app.home;

async function landingAfterAuth(
  client: ReturnType<typeof getSupabaseServerClient>,
  nextPath: string | null | undefined,
) {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return nextPath ?? HOME;

  return resolvePostAuthLandingPath(client, user.id, nextPath, HOME);
}

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const service = createAuthCallbackService(client);
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');

  const baseParams = {
    joinTeamPath: pathsConfig.app.joinTeam,
    redirectPath: HOME,
  };

  if (tokenHash && type) {
    const redirectUrl = await service.verifyTokenHash(request, baseParams);
    const nextFromVerify = `${redirectUrl.pathname}${redirectUrl.search}`;
    return redirect(await landingAfterAuth(client, nextFromVerify));
  }

  if (code) {
    const { nextPath } = await service.exchangeCodeForSession(
      request,
      baseParams,
    );
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
      var tokenHash = params.get('token_hash');
      var type = params.get('type');
      if (tokenHash && type) {
        fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash, type: type })
        })
          .then(function(r) {
            if (r.ok) window.location.replace('${HOME}');
            else r.json().then(function(d) {
              window.location.replace('/auth/callback/error?error=' + encodeURIComponent(d.error || 'Verification failed'));
            });
          })
          .catch(function() {
            window.location.replace('/auth/callback/error?error=Verification+failed');
          });
      } else {
        window.location.replace('${HOME}');
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
