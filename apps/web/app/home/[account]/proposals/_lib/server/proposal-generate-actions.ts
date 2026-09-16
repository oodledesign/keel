'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { createSurveyCaptureService } from '~/home/[account]/surveys/_lib/server/survey-capture.service';
import {
  type ProposalTranscript,
  editProposalHtml,
  generateProposalHtml,
} from '~/lib/ai/proposal-generate';
import { generateSurveyReportHtml } from '~/lib/ai/survey-report-generate';
import { combineSurveyStyleGuidance } from '~/lib/ai/survey-style-distill';
import { signSurveyPhotoUrls } from '~/lib/building-surveyor/survey-photo-urls';
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

/** Same invoices.edit gate as the proposal writer — survey reports reuse that permission. */
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

const observationSchema = z.object({
  sectionKey: z.string().min(1).max(80),
  body: z.string().min(1).max(20_000),
});

const pinnedPhotoSchema = z.object({
  sectionKey: z.string().min(1).max(80),
  title: z.string().min(1).max(500),
  caption: z.string().max(1000).nullable().optional(),
  documentId: z.string().uuid().optional(),
  url: z.string().max(2_000).nullable().optional(),
});

const generateSurveyReportSchema = z
  .object({
    accountId: z.string().uuid(),
    proposalId: z.string().uuid().optional(),
    propertyLabel: z.string().min(1).max(500),
    clientName: z.string().max(500).nullable().optional(),
    accountName: z.string().min(1).max(500),
    surveyorName: z.string().min(1).max(500),
    surveyType: z.string().max(80).nullable().optional(),
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
    observations: z.array(observationSchema).max(200).optional(),
    pinnedPhotos: z.array(pinnedPhotoSchema).max(80).optional(),
  })
  .refine(
    (data) =>
      data.transcripts.length > 0 ||
      (data.contextNotes?.length ?? 0) > 0 ||
      (data.observations?.length ?? 0) > 0 ||
      Boolean(data.proposalId),
    {
      message:
        'Provide at least one site transcript, grouped observation, or note/file',
    },
  );

export const generateSurveyReportHtmlAction = enhanceAction(
  async (input, user) => {
    await assertInvoicesEditPermission(input.accountId, user.id);

    const client = getSupabaseServerClient();
    const capture = createSurveyCaptureService(client);
    await capture.assertBuildingSurveyorAccount(input.accountId);

    let observations = input.observations;
    let pinnedPhotos = input.pinnedPhotos;
    let surveyType = input.surveyType ?? null;
    let styleGuidance: string | null = null;

    if (input.proposalId) {
      const survey = await capture.getSurvey(input.accountId, input.proposalId);
      surveyType = survey.survey_type ?? surveyType;
      if (!observations?.length) {
        const rows = await capture.listObservations(
          input.accountId,
          input.proposalId,
        );
        observations = rows.map((row) => ({
          sectionKey: row.sectionKey,
          body: row.body,
        }));
      }
      if (!pinnedPhotos?.length) {
        const photos = await capture.listPinnedPhotos(
          input.accountId,
          input.proposalId,
        );
        const photoUrls = await signSurveyPhotoUrls(
          getSupabaseServerAdminClient(),
          photos.map((photo) => ({
            id: photo.documentId,
            filePath: photo.filePath,
            storagePath: photo.storagePath,
            storageBucket: photo.storageBucket,
          })),
        );
        pinnedPhotos = photos.map((photo) => ({
          sectionKey: photo.sectionKey,
          title: photo.title,
          caption: photo.caption,
          documentId: photo.documentId,
          url: photoUrls[photo.documentId] ?? null,
        }));
      }
      const styleExamples = await capture.listStyleExamples(input.accountId);
      styleGuidance = combineSurveyStyleGuidance(
        styleExamples.map((example) => ({
          title: example.title,
          styleNotes: example.styleNotes,
        })),
      );
    }

    const result = await generateSurveyReportHtml(
      {
        propertyLabel: input.propertyLabel.trim(),
        clientName: input.clientName?.trim() || null,
        accountName: input.accountName.trim(),
        surveyorName: input.surveyorName.trim(),
        surveyType,
        transcripts: input.transcripts.map((t) => ({
          title: t.title.trim(),
          content: t.content.trim(),
        })),
        contextNotes: input.contextNotes?.map((n) => ({
          title: n.title.trim(),
          content: n.content.trim(),
          type: n.type,
        })),
        observations,
        pinnedPhotos,
        styleGuidance,
      },
      { accountId: input.accountId, supabase: client },
    );

    return result;
  },
  { schema: generateSurveyReportSchema },
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
