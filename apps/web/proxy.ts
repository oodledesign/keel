import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { CsrfError, createCsrfProtect } from '@edge-csrf/nextjs';

import { isSuperAdmin } from '@kit/admin';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { getSupabaseAuthCookieDomain } from '@kit/supabase/get-supabase-auth-cookie-options';
import { createMiddlewareClient } from '@kit/supabase/middleware-client';

import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import {
  AGENCY_PORTAL_REQUEST_HEADER,
  buildAgencyPortalRewritePath,
  extractAgencyPortalSlug,
} from '~/lib/agency-portal-host';
import {
  getAppSiteOrigin,
  getMarketingSiteOrigin,
} from '~/lib/app-host-routing';
import {
  isAppRoute,
  isMarketingRoute,
  resolveAppSubdomainRedirect,
} from '~/lib/app-subdomain-host';
import { getUserDefaultLandingPath } from '~/lib/dashboard-shortcuts/load-shortcuts';
import {
  appendMissingSearchParams,
  isExplicitPersonalHomeRequest,
  isPersonalDashboardRoot,
} from '~/lib/dashboard-shortcuts/personal-home-url';
import { applyNoIndexResponseHeader } from '~/lib/seo/search-indexing';
import {
  getMiddlewareAuthenticatedUser,
  getMiddlewareSessionUser,
} from '~/lib/server/middleware-auth';

const CSRF_SECRET_COOKIE = 'csrfSecret';
const NEXT_ACTION_HEADER = 'next-action';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|brand|images|locales|assets|api|sw.js|manifest.webmanifest|favicon.ico|favicon.svg|robots.txt).*)',
  ],
};

function createForwardHeaders(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  requestHeaders.set('x-pathname', pathname);

  if (isServerAction(request)) {
    requestHeaders.set('x-action-path', pathname);
  }

  return requestHeaders;
}

function createNextResponse(request: NextRequest, init?: ResponseInit) {
  return NextResponse.next({
    ...init,
    request: {
      headers: createForwardHeaders(request),
    },
  });
}

function redirectAppSubdomainRequest(request: NextRequest) {
  const target = resolveAppSubdomainRedirect(request.nextUrl);

  if (!target) {
    return null;
  }

  return NextResponse.redirect(target, 307);
}

function redirectAgencyHostAppRoutes(request: NextRequest) {
  const slug = extractAgencyPortalSlug(request.nextUrl.hostname);

  if (!slug) {
    return null;
  }

  const { pathname, search } = request.nextUrl;

  if (isAppRoute(pathname)) {
    return NextResponse.redirect(
      `${getAppSiteOrigin()}${pathname}${search}`,
      307,
    );
  }

  if (pathname !== '/' && isMarketingRoute(pathname)) {
    return NextResponse.redirect(
      `${getMarketingSiteOrigin()}${pathname}${search}`,
      307,
    );
  }

  return null;
}

function rewriteAgencyPortalRequest(request: NextRequest) {
  const slug = extractAgencyPortalSlug(request.nextUrl.hostname);

  if (!slug) {
    return null;
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = buildAgencyPortalRewritePath(
    slug,
    request.nextUrl.pathname,
  );

  const requestHeaders = createForwardHeaders(request);
  requestHeaders.set(AGENCY_PORTAL_REQUEST_HEADER, '1');

  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  setRequestId(request);

  return response;
}

/**
 * Static marketing / legacy redirects that used to live in next.config.
 * Kept here so they do not count toward Vercel's 2048 deployment-route limit.
 * Behaviour must stay in sync with the former getRedirects() entries.
 */
function redirectStaticConfigPaths(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const origin = request.nextUrl.origin;

  const exact: Record<string, { to: string; permanent?: boolean }> = {
    '/early-access': { to: '/pricing', permanent: true },
    '/assistant': { to: '/download', permanent: true },
    '/downloads/OzerAssistant-latest.zip': {
      to: '/downloads/OzerAssistant-1.0.zip',
    },
    '/server-sitemap.xml': { to: '/sitemap.xml', permanent: true },
    '/features/freeagent': { to: '/features/finances', permanent: true },
    '/about': { to: '/' },
    '/careers': { to: '/' },
    '/changelog': { to: '/' },
    '/property': { to: '/#coming-soon' },
    '/community': { to: '/#coming-soon' },
    '/apps/rankly': { to: '/#coming-soon' },
    '/apps/feedflow': { to: '/#coming-soon' },
    '/apps/videos': { to: '/#coming-soon' },
  };

  const exactHit = exact[pathname];
  if (exactHit) {
    return NextResponse.redirect(
      new URL(`${exactHit.to}${search}`, origin),
      exactHit.permanent ? 308 : 307,
    );
  }

  if (pathname.startsWith('/changelog/')) {
    return NextResponse.redirect(new URL(`/${search}`, origin), 307);
  }

  if (pathname.startsWith('/property/') || pathname.startsWith('/community/')) {
    return NextResponse.redirect(new URL('/#coming-soon', origin), 307);
  }

  const docsOrigin = (
    process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.ozer.so'
  ).replace(/\/$/, '');

  if (pathname === '/docs') {
    return NextResponse.redirect(`${docsOrigin}/`, 308);
  }

  if (pathname.startsWith('/docs/')) {
    return NextResponse.redirect(
      `${docsOrigin}${pathname.slice('/docs'.length)}${search}`,
      308,
    );
  }

  // Legacy portal support → services
  const portalSupport = pathname.match(
    /^\/portal\/([^/]+)\/support(?:\/(new|[^/]+))?$/,
  );
  if (portalSupport) {
    const clientSlug = portalSupport[1]!;
    const rest = portalSupport[2] ? `/${portalSupport[2]}` : '';
    return NextResponse.redirect(
      new URL(`/portal/${clientSlug}/services${rest}${search}`, origin),
      308,
    );
  }

  // Legacy oodle-1 workspace slug
  if (pathname === '/app/work/oodle-1' || pathname === '/home/oodle-1') {
    return NextResponse.redirect(new URL(`/app/oodle${search}`, origin), 308);
  }
  if (
    pathname.startsWith('/app/work/oodle-1/') ||
    pathname.startsWith('/home/oodle-1/')
  ) {
    const suffix = pathname.replace(/^\/(app\/work|home)\/oodle-1/, '');
    return NextResponse.redirect(
      new URL(`/app/oodle${suffix}${search}`, origin),
      308,
    );
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const staticRedirect = redirectStaticConfigPaths(request);

  if (staticRedirect) {
    return staticRedirect;
  }

  const appHostRedirect = redirectAppSubdomainRequest(request);

  if (appHostRedirect) {
    return withCsrfMiddleware(request, appHostRedirect);
  }

  const agencyAppRedirect = redirectAgencyHostAppRoutes(request);

  if (agencyAppRedirect) {
    return withCsrfMiddleware(request, agencyAppRedirect);
  }

  const agencyPortalResponse = rewriteAgencyPortalRequest(request);

  if (agencyPortalResponse) {
    return withCsrfMiddleware(request, agencyPortalResponse);
  }

  const secureHeaders = await createResponseWithSecureHeaders();
  const response = createNextResponse(request, secureHeaders);

  // set a unique request ID for each request
  // this helps us log and trace requests
  setRequestId(request);

  // apply CSRF protection for mutating requests
  const csrfResponse = await withCsrfMiddleware(request, response);

  // handle patterns for specific routes
  const handlePattern = await matchUrlPattern(request.url);

  // if a pattern handler exists, call it
  if (handlePattern) {
    const patternHandlerResponse = await handlePattern(request, csrfResponse);

    // if a pattern handler returns a response, return it
    if (patternHandlerResponse) {
      return applyNoIndexResponseHeader(
        patternHandlerResponse,
        request.nextUrl.pathname,
      );
    }
  }

  // if no pattern handler returned a response,
  // return the session response
  return applyNoIndexResponseHeader(csrfResponse, request.nextUrl.pathname);
}

async function withCsrfMiddleware(
  request: NextRequest,
  response: NextResponse,
) {
  // set up CSRF protection
  const csrfProtect = createCsrfProtect({
    cookie: {
      secure: appConfig.production,
      name: CSRF_SECRET_COOKIE,
      ...(getSupabaseAuthCookieDomain()
        ? { domain: getSupabaseAuthCookieDomain() }
        : {}),
    },
    // ignore CSRF errors for server actions since protection is built-in
    ignoreMethods: isServerAction(request)
      ? ['POST']
      : // always ignore GET, HEAD, and OPTIONS requests
        ['GET', 'HEAD', 'OPTIONS'],
  });

  try {
    await csrfProtect(request, response);

    return applyNoIndexResponseHeader(response, request.nextUrl.pathname);
  } catch (error) {
    // if there is a CSRF error, return a 403 response
    if (error instanceof CsrfError) {
      return NextResponse.json('Invalid CSRF token', {
        status: 401,
      });
    }

    throw error;
  }
}

function isServerAction(request: NextRequest) {
  const headers = new Headers(request.headers);

  return headers.has(NEXT_ACTION_HEADER);
}

async function adminMiddleware(request: NextRequest, response: NextResponse) {
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');

  if (!isAdminPath) {
    return;
  }

  const { user, supabase } = await getMiddlewareAuthenticatedUser(
    request,
    response,
  );

  // If user is not logged in, redirect to sign in page.
  if (!user) {
    const signInUrl = new URL(pathsConfig.auth.signIn, request.nextUrl.origin);
    const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

    if (returnPath && returnPath !== pathsConfig.auth.signIn) {
      signInUrl.searchParams.set('next', returnPath);
    }

    return NextResponse.redirect(signInUrl.href);
  }

  const userIsSuperAdmin = await isSuperAdmin(supabase);

  // If user is not an admin, redirect to 404 page.
  if (!userIsSuperAdmin) {
    return NextResponse.redirect(new URL('/404', request.nextUrl.origin).href);
  }

  // in all other cases, return the response
  return response;
}

function isAuthCompletionPath(pathname: string) {
  return (
    pathname === pathsConfig.auth.callback ||
    pathname === pathsConfig.auth.native ||
    pathname === '/auth/confirm' ||
    pathname.startsWith('/auth/callback/')
  );
}

async function personalAppAuthHandler(req: NextRequest, res: NextResponse) {
  const { user, supabase } = await getMiddlewareAuthenticatedUser(req, res);
  const { origin, pathname: next } = req.nextUrl;

  if (!user) {
    const signIn = pathsConfig.auth.signIn;
    const redirectPath = `${signIn}?next=${next}`;

    return NextResponse.redirect(new URL(redirectPath, origin).href);
  }

  const requiresMultiFactorAuthentication =
    await checkRequiresMultiFactorAuthentication(supabase);

  if (requiresMultiFactorAuthentication) {
    const verifyUrl = new URL(pathsConfig.auth.verifyMfa, origin);
    verifyUrl.searchParams.set('next', `${next}${req.nextUrl.search}`);
    return NextResponse.redirect(verifyUrl.href);
  }

  if (!user.email_confirmed_at && next !== pathsConfig.auth.verifyEmail) {
    return NextResponse.redirect(
      new URL(pathsConfig.auth.verifyEmail, origin).href,
    );
  }

  if (
    isPersonalDashboardRoot(next) &&
    !isExplicitPersonalHomeRequest(req.nextUrl.searchParams)
  ) {
    try {
      const landingPath = await getUserDefaultLandingPath(supabase, user.id);

      if (landingPath !== pathsConfig.app.home) {
        const target = appendMissingSearchParams(
          new URL(landingPath, origin),
          req.nextUrl.searchParams,
          { prefix: 'feedflow_' },
        );
        return NextResponse.redirect(target.href);
      }
    } catch {
      // Fall through to personal home.
    }
  }
}

/**
 * Define URL patterns and their corresponding handlers.
 */
async function getPatterns() {
  let URLPattern = globalThis.URLPattern;

  if (!URLPattern) {
    const { URLPattern: polyfill } = await import('urlpattern-polyfill');
    URLPattern = polyfill as typeof URLPattern;
  }

  return [
    {
      pattern: new URLPattern({ pathname: '/admin/*?' }),
      handler: adminMiddleware,
    },
    {
      pattern: new URLPattern({ pathname: '/auth/*?' }),
      handler: async (req: NextRequest, res: NextResponse) => {
        const pathname = req.nextUrl.pathname;

        // OAuth / magic-link handlers must run even when stale cookies exist.
        if (isAuthCompletionPath(pathname)) {
          await getMiddlewareSessionUser(req, res);
          return;
        }

        const sessionUser = await getMiddlewareSessionUser(req, res);

        if (!sessionUser) {
          return;
        }

        const isVerifyMfa = pathname === pathsConfig.auth.verifyMfa;
        const isVerifyEmail = pathname === pathsConfig.auth.verifyEmail;

        if (!isVerifyMfa && !isVerifyEmail) {
          const nextParam = req.nextUrl.searchParams.get('next');
          const client = createMiddlewareClient(req, res);

          let nextPath = getSafeRedirectPath(nextParam, pathsConfig.app.home);

          if (
            !nextParam?.trim() ||
            nextPath === pathsConfig.app.home ||
            nextPath === '/'
          ) {
            try {
              nextPath = await getUserDefaultLandingPath(
                client,
                sessionUser.id,
              );
            } catch {
              nextPath = pathsConfig.app.home;
            }
          }

          return NextResponse.redirect(
            new URL(nextPath, req.nextUrl.origin).href,
          );
        }
      },
    },
    {
      pattern: new URLPattern({ pathname: '/home/*?' }),
      handler: personalAppAuthHandler,
    },
    {
      pattern: new URLPattern({ pathname: '/app/*?' }),
      handler: personalAppAuthHandler,
    },
  ];
}

/**
 * Match URL patterns to specific handlers.
 * @param url
 */
async function matchUrlPattern(url: string) {
  const patterns = await getPatterns();
  const input = url.split('?')[0];

  for (const pattern of patterns) {
    const patternResult = pattern.pattern.exec(input);

    if (patternResult !== null && 'pathname' in patternResult) {
      return pattern.handler;
    }
  }
}

/**
 * Set a unique request ID for each request.
 * @param request
 */
function setRequestId(request: Request) {
  request.headers.set('x-correlation-id', crypto.randomUUID());
}

/**
 * @name createResponseWithSecureHeaders
 * @description Create a middleware with enhanced headers applied (if applied).
 * This is disabled by default. To enable set ENABLE_STRICT_CSP=true
 */
async function createResponseWithSecureHeaders() {
  const enableStrictCsp =
    process.env.ENABLE_STRICT_CSP ??
    (process.env.NODE_ENV === 'production' ? 'true' : 'false');

  // we disable ENABLE_STRICT_CSP by default in development
  if (enableStrictCsp === 'false') {
    return {};
  }

  const { createCspResponse } = await import('./lib/create-csp-response');

  return createCspResponse();
}
