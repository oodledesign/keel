import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { streamProposalEditHtml } from '~/lib/ai/proposal-generate';
import { formatUserFacingAiError } from '~/lib/ai/format-ai-provider-error';
import {
  insufficientCreditsResponse,
  isInsufficientCreditsError,
} from '~/lib/ai/router';
import { loadVoicePromptBlock } from '~/lib/voice/load-voice-prompt-block';

export const dynamic = 'force-dynamic';

const editSchema = z.object({
  accountId: z.string().uuid(),
  contentHtml: z.string().min(1).max(200_000),
  instruction: z.string().min(1).max(4000),
  recipientName: z.string().max(500).nullable().optional(),
  accountName: z.string().max(500).nullable().optional(),
  senderName: z.string().max(500).nullable().optional(),
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

  throw new Error('You do not have permission to edit proposals with AI');
}

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = editSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid edit request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await assertInvoicesEditPermission(parsed.data.accountId, user.id);

    const voicePromptBlock = await loadVoicePromptBlock(client, {
      userId: user.id,
      accountId: parsed.data.accountId,
      purpose: 'proposal',
    });

    const stream = await streamProposalEditHtml(
      {
        contentHtml: parsed.data.contentHtml,
        instruction: parsed.data.instruction.trim(),
        recipientName: parsed.data.recipientName?.trim() || null,
        accountName: parsed.data.accountName?.trim() || null,
        senderName: parsed.data.senderName?.trim() || null,
        voicePromptBlock,
      },
      { accountId: parsed.data.accountId, supabase: client },
    );

    return new Response(stream, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return NextResponse.json(insufficientCreditsResponse(err), {
        status: 402,
      });
    }

    return NextResponse.json(
      {
        error: formatUserFacingAiError(
          err,
          'Could not edit proposal with AI',
        ),
      },
      { status: 502 },
    );
  }
}
