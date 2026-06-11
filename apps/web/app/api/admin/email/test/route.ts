import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import { sendTestCampaignEmail } from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await requireSuperAdmin();
  const body = (await request.json().catch(() => null)) as {
    to?: string;
    subject?: string;
    html?: string;
    text?: string | null;
    prefix?: 'Test' | 'Copy';
  } | null;

  if (!body?.to || !body.subject || !body.html) {
    return NextResponse.json(
      { error: 'to, subject, and html are required', userId },
      { status: 400 },
    );
  }

  await sendTestCampaignEmail({
    to: body.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    prefix: body.prefix,
  });

  return NextResponse.json({ ok: true });
}
