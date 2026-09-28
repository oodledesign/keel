import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  CIRCULATION_UNSUBSCRIBE_PAGE_PATH,
  createCommercialCirculationService,
  decodeCirculationUnsubscribeToken,
} from '~/lib/commercial/circulation/circulation.service';

export const dynamic = 'force-dynamic';

function confirmPageUrl(request: Request, token: string | null) {
  const url = new URL(CIRCULATION_UNSUBSCRIBE_PAGE_PATH, request.url);
  if (token) url.searchParams.set('token', token);
  return url;
}

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * POST /api/circulation/unsubscribe?token=…
 *
 * Mail clients send RFC 8058 one-click (`List-Unsubscribe=One-Click`) and get
 * a bare 200. The confirm page's form posts here too and is sent back to the
 * page with a 303. /api is outside the proxy matcher, so no CSRF or session.
 */
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    const form = await readForm(request);
    const url = new URL(request.url);
    const token =
      url.searchParams.get('token') ??
      (typeof form?.get('token') === 'string'
        ? (form.get('token') as string)
        : null);
    const oneClick = form?.get('List-Unsubscribe') === 'One-Click';
    const decoded = token ? decodeCirculationUnsubscribeToken(token) : null;

    if (!decoded) {
      return oneClick
        ? new NextResponse('Invalid unsubscribe link', { status: 400 })
        : NextResponse.redirect(confirmPageUrl(request, token), 303);
    }

    try {
      await createCommercialCirculationService(
        getSupabaseServerAdminClient(),
      ).unsubscribe(decoded.accountId, decoded.email, {
        source: oneClick ? 'one_click' : 'confirm_page',
      });
    } catch (err) {
      console.error(
        '[circulation-unsubscribe] failed:',
        err instanceof Error ? err.message : err,
      );
      return oneClick
        ? new NextResponse('Could not unsubscribe', { status: 500 })
        : NextResponse.redirect(confirmPageUrl(request, token), 303);
    }

    if (oneClick) {
      return new NextResponse('Unsubscribed', { status: 200 });
    }

    return NextResponse.redirect(confirmPageUrl(request, token), 303);
  },
  { auth: false },
);

/** Clients without one-click support open the header URL; never unsubscribe on GET. */
export const GET = enhanceRouteHandler(
  async ({ request }) => {
    const token = new URL(request.url).searchParams.get('token');
    return NextResponse.redirect(confirmPageUrl(request, token), 303);
  },
  { auth: false },
);
