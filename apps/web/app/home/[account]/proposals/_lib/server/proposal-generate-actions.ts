'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  generateProposalHtml,
  type ProposalTranscript,
} from '~/lib/ai/proposal-generate';

const transcriptSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(120_000),
});

const generateProposalSchema = z.object({
  accountId: z.string().uuid(),
  recipientName: z.string().min(1).max(500),
  recipientCompany: z.string().max(500).nullable().optional(),
  accountName: z.string().min(1).max(500),
  senderName: z.string().min(1).max(500),
  transcripts: z.array(transcriptSchema).max(20),
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

export const generateProposalHtmlAction = enhanceAction(
  async (input, user) => {
    await assertInvoicesEditPermission(input.accountId, user.id);

    const transcripts: ProposalTranscript[] = input.transcripts.map((t) => ({
      title: t.title.trim(),
      content: t.content.trim(),
    }));

    const contentHtml = await generateProposalHtml({
      recipientName: input.recipientName.trim(),
      recipientCompany: input.recipientCompany?.trim() || null,
      accountName: input.accountName.trim(),
      senderName: input.senderName.trim(),
      transcripts,
      referenceProposalHtml: input.referenceProposalHtml?.trim() || null,
      dealValue: input.dealValue ?? null,
    });

    return { contentHtml };
  },
  { schema: generateProposalSchema },
);
