import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  loadIntegrationInviteByToken,
  markIntegrationInviteUsed,
} from '~/lib/signatures/integration-invite';
import {
  connectGoogleWorkspace,
} from '~/lib/signatures/google-workspace';

export const runtime = 'nodejs';

const BodySchema = z.object({
  token: z.string().min(32).max(128),
  primaryDomain: z.string().trim().min(3).max(253),
  delegatedAdminEmail: z.string().trim().email(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const invite = await loadIntegrationInviteByToken(body.token);
  if (!invite || invite.provider !== 'google') {
    return NextResponse.json(
      { error: 'This link is invalid or has expired' },
      { status: 404 },
    );
  }

  try {
    await connectGoogleWorkspace({
      accountId: invite.account_id,
      primaryDomain: body.primaryDomain.toLowerCase(),
      delegatedAdminEmail: body.delegatedAdminEmail.toLowerCase(),
      connectedBy: invite.created_by,
    });

    await markIntegrationInviteUsed({
      inviteId: invite.id,
      accountId: invite.account_id,
      usedByEmail: body.delegatedAdminEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google connection failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
