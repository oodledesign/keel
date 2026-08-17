import { NextRequest, NextResponse } from 'next/server';

import { isSafeRedirectPath } from '@kit/shared/utils';

import pathsConfig from '~/config/paths.config';

/**
 * Email confirmation / recovery links land here
 * (`/auth/confirm?token_hash=…&type=…&callback=…`).
 *
 * IMPORTANT: Corporate email scanners (Microsoft Safe Links, etc.) prefetch
 * links with HEAD and sometimes GET. Next.js maps HEAD → GET by default, which
 * used to call verifyOtp and burn one-time tokens before the user clicked.
 *
 * Flow:
 * - HEAD → empty 200 (never verify)
 * - GET → interstitial page; OTP is only verified after an explicit button click
 *   (POST /api/auth/verify-otp), which scanners do not perform.
 */

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveNextPath(type: string | null, callback: string | null): string {
  if (type === 'recovery') {
    return pathsConfig.auth.passwordUpdate;
  }

  if (callback) {
    if (callback.startsWith('/') && isSafeRedirectPath(callback)) {
      return callback;
    }
    try {
      const url = new URL(callback);
      const path = `${url.pathname}${url.search}`;
      if (isSafeRedirectPath(path)) {
        return path;
      }
    } catch {
      // ignore invalid callback
    }
  }

  return pathsConfig.app.home;
}

function ctaLabel(type: string | null): string {
  switch (type) {
    case 'recovery':
      return 'Continue to reset password';
    case 'invite':
      return 'Accept invite';
    case 'magiclink':
      return 'Continue to sign in';
    case 'email_change':
      return 'Confirm email change';
    default:
      return 'Continue';
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const callback =
    request.nextUrl.searchParams.get('callback') ??
    request.nextUrl.searchParams.get('next');

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL(pathsConfig.auth.signIn, request.url));
  }

  const nextPath = resolveNextPath(type, callback);
  const label = ctaLabel(type);

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Continue — Ozer</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #FBF6EC; color: #2A1720;
    }
    .card {
      width: min(420px, calc(100vw - 32px));
      background: #fff; border: 1px solid #E7DECF; border-radius: 16px;
      padding: 28px 24px; box-shadow: 0 8px 30px rgba(42,23,32,0.06);
    }
    h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.25; }
    p { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #5A4450; }
    button {
      width: 100%; border: 0; border-radius: 999px; padding: 14px 20px;
      background: #FF5C34; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
    }
    button:disabled { opacity: 0.7; cursor: wait; }
    .err { display:none; margin-top: 14px; padding: 12px; border-radius: 10px;
      border: 1px solid #F5C4A8; background: #FFF6F0; color: #B5471C; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Almost there</h1>
    <p>Confirm it’s you to finish signing in. This step stops email security tools from using the link before you do.</p>
    <button type="button" id="continue">${escapeHtml(label)}</button>
    <div class="err" id="err"></div>
  </div>
  <script>
    (function () {
      var tokenHash = ${JSON.stringify(tokenHash)};
      var type = ${JSON.stringify(type)};
      var nextPath = ${JSON.stringify(nextPath)};
      var btn = document.getElementById('continue');
      var err = document.getElementById('err');
      btn.addEventListener('click', function () {
        btn.disabled = true;
        err.style.display = 'none';
        fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash, type: type })
        }).then(function (r) {
          return r.json().then(function (d) {
            if (r.ok) {
              window.location.replace(nextPath);
              return;
            }
            var code = d && d.code ? encodeURIComponent(d.code) : '';
            var message = (d && d.error) ? d.error : 'Verification failed';
            var q = 'error=' + encodeURIComponent(message);
            if (code) q += '&code=' + code;
            window.location.replace('/auth/callback/error?' + q);
          });
        }).catch(function () {
          window.location.replace('/auth/callback/error?error=' + encodeURIComponent('Verification failed'));
        });
      });
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
