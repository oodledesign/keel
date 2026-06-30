import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import {
  getZeptomailDiagnostics,
  sendTransactionalEmail,
} from '~/lib/email/zeptomail-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireSuperAdmin();

  return NextResponse.json(getZeptomailDiagnostics());
}

export async function POST(request: Request) {
  await requireSuperAdmin();

  const body = (await request.json().catch(() => null)) as { to?: string } | null;
  const to = body?.to?.trim();

  if (!to) {
    return NextResponse.json({ error: 'to is required' }, { status: 400 });
  }

  const diagnostics = getZeptomailDiagnostics();

  try {
    const result = await sendTransactionalEmail({
      to,
      subject: 'Ozer email delivery test',
      htmlBody:
        '<p>If you received this, Ozer outbound email is working via <strong>ZeptoMail</strong>.</p>',
    });

    if (!result.sent) {
      return NextResponse.json(
        {
          ok: false,
          diagnostics,
          error: `${to} is on the email suppression list.`,
        },
        { status: 400 },
      );
    }

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
