import { NextResponse } from 'next/server';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import {
  estimateCampaignRecipients,
  parseManualEmails,
  type EmailRecipientList,
} from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  await requireSuperAdmin();

  const body = (await request.json().catch(() => null)) as {
    recipientList?: EmailRecipientList;
    contactListId?: string | null;
    manualRecipientEmails?: string | string[] | null;
    customRecipientIds?: string[] | null;
  } | null;

  if (!body?.recipientList) {
    return NextResponse.json(
      { error: 'recipientList is required' },
      { status: 400 },
    );
  }

  const count = await estimateCampaignRecipients({
    recipient_list: body.recipientList,
    contact_list_id: body.contactListId?.trim() || null,
    manual_recipient_emails: parseManualEmails(body.manualRecipientEmails),
    custom_recipient_ids: body.customRecipientIds ?? null,
  });

  return NextResponse.json({ count });
}
