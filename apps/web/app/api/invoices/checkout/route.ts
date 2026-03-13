import { NextResponse } from 'next/server';

import { createInvoiceCheckoutSessionByToken } from '~/home/[account]/invoices/_lib/server/invoice-checkout';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const url = await createInvoiceCheckoutSessionByToken(token);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start payment';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
