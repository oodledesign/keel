import { NextResponse } from 'next/server';

import { createInvoiceCheckoutSessionByToken } from '~/home/[account]/invoices/_lib/server/invoice-checkout';

function portalErrorRedirect(request: Request, token: string, message: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    new URL(request.url).origin;
  const origin = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  const url = new URL(`/portal/invoices/${encodeURIComponent(token)}`, origin);
  url.searchParams.set('checkout_error', message.slice(0, 280));
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const deposit = searchParams.get('deposit') === '1';

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const url = await createInvoiceCheckoutSessionByToken(token, {
      payDepositOnly: deposit,
    });
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start payment';

    return portalErrorRedirect(request, token, message);
  }
}
