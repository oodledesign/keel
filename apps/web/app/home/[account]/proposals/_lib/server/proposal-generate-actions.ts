'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  type ProposalTranscript,
  editProposalHtml,
  generateProposalHtml,
} from '~/lib/ai/proposal-generate';
import { loadVoicePromptBlock } from '~/lib/voice/load-voice-prompt-block';

const transcriptSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(120_000),
});

const generateProposalSchema = z
  .object({
    accountId: z.string().uuid(),
    recipientName: z.string().min(1).max(500),
    recipientCompany: z.string().max(500).nullable().optional(),
    accountName: z.string().min(1).max(500),
    senderName: z.string().min(1).max(500),
    transcripts: z.array(transcriptSchema).max(20).default([]),
    contextNotes: z
      .array(
        z.object({
          title: z.string().min(1).max(500),
          content: z.string().min(1).max(120_000),
          type: z.enum(['note', 'file']),
        }),
      )
      .max(20)
      .optional(),
    referenceProposalHtml: z.string().max(200_000).nullable().optional(),
    dealValue: z.number().nonnegative().nullable().optional(),
  })
  .refine(
    (data) =>
      data.transcripts.length > 0 || (data.contextNotes?.length ?? 0) > 0,
    { message: 'Provide at least one transcript or note/file for context' },
  );

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

    const client = getSupabaseServerClient();
    const voicePromptBlock = await loadVoicePromptBlock(client, {
      userId: user.id,
      accountId: input.accountId,
      purpose: 'proposal',
    });

    const contentHtml = await generateProposalHtml(
      {
        recipientName: input.recipientName.trim(),
        recipientCompany: input.recipientCompany?.trim() || null,
        accountName: input.accountName.trim(),
        senderName: input.senderName.trim(),
        transcripts,
        contextNotes: input.contextNotes?.map((n) => ({
          title: n.title.trim(),
          content: n.content.trim(),
          type: n.type,
        })),
        referenceProposalHtml: input.referenceProposalHtml?.trim() || null,
        dealValue: input.dealValue ?? null,
        voicePromptBlock,
      },
      { accountId: input.accountId, supabase: client },
    );

    return { contentHtml };
  },
  { schema: generateProposalSchema },
);

const editProposalSchema = z.object({
  accountId: z.string().uuid(),
  contentHtml: z.string().min(1).max(200_000),
  instruction: z.string().min(1).max(4000),
  recipientName: z.string().max(500).nullable().optional(),
  accountName: z.string().max(500).nullable().optional(),
  senderName: z.string().max(500).nullable().optional(),
});

export const editProposalHtmlAction = enhanceAction(
  async (input, user) => {
    await assertInvoicesEditPermission(input.accountId, user.id);

    const client = getSupabaseServerClient();
    const voicePromptBlock = await loadVoicePromptBlock(client, {
      userId: user.id,
      accountId: input.accountId,
      purpose: 'proposal',
    });

    const contentHtml = await editProposalHtml(
      {
        contentHtml: input.contentHtml,
        instruction: input.instruction.trim(),
        recipientName: input.recipientName?.trim() || null,
        accountName: input.accountName?.trim() || null,
        senderName: input.senderName?.trim() || null,
        voicePromptBlock,
      },
      { accountId: input.accountId, supabase: client },
    );

    return { contentHtml };
  },
  { schema: editProposalSchema },
);
