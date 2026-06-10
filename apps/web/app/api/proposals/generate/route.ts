import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { streamProposalHtml } from '~/lib/ai/proposal-generate';

export const dynamic = 'force-dynamic';

const transcriptSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(120_000),
});

const generateSchema = z.object({
  accountId: z.string().uuid(),
  recipientName: z.string().min(1).max(500),
  recipientCompany: z.string().max(500).nullable().optional(),
  accountName: z.string().min(1).max(500),
  senderName: z.string().min(1).max(500),
  transcripts: z.array(transcriptSchema).min(1).max(20),
  referenceProposalHtml: z.string().max(200_000).nullable().optional(),
  dealValue: z.number().nonnegative().nullable().optional(),
});

async function assertInvoicesEditPermission(accountId: string, userId: string) {
  const client = getSupabaseServerClient();
  const api = createTeamAccountsApi(client);
  const hasPermission = await api.hasPermission({
    userId,
    accountId,
    permission: 'invoices.edit',
  });

  if (hasPermission) return;

  const { data: membership, error } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  const role = membership?.account_role;
  if (role === 'owner' || role === 'admin' || role === 'staff') {
    return;
  }

  throw new Error('You do not have permission to generate proposals');
}

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = generateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid proposal request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await assertInvoicesEditPermission(parsed.data.accountId, user.id);

    const stream = await streamProposalHtml({
      recipientName: parsed.data.recipientName.trim(),
      recipientCompany: parsed.data.recipientCompany?.trim() || null,
      accountName: parsed.data.accountName.trim(),
      senderName: parsed.data.senderName.trim(),
      transcripts: parsed.data.transcripts.map((t) => ({
        title: t.title.trim(),
        content: t.content.trim(),
      })),
      referenceProposalHtml: parsed.data.referenceProposalHtml?.trim() || null,
      dealValue: parsed.data.dealValue ?? null,
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not generate proposal',
      },
      { status: 502 },
    );
  }
}
