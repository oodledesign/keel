import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import {
  getOutboundEmailDiagnostics,
  sendSesRawEmail,
} from '~/lib/server/ses-raw-email';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireSuperAdmin();

  return NextResponse.json(getOutboundEmailDiagnostics());
}

export async function POST(request: Request) {
  await requireSuperAdmin();

  const body = (await request.json().catch(() => null)) as { to?: string } | null;
  const to = body?.to?.trim();

  if (!to) {
    return NextResponse.json({ error: 'to is required' }, { status: 400 });
  }

  const diagnostics = getOutboundEmailDiagnostics();

  try {
    await sendSesRawEmail({
      to,
      subject: 'Ozer email delivery test',
      html: `<p>If you received this, Ozer outbound email is working via <strong>${diagnostics.transport}</strong>.</p>`,
    });

    return NextResponse.json({
      ok: true,
      diagnostics,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        diagnostics,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
