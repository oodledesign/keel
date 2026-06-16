'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';

import { createMeetingTranscriptsService } from '../../../_lib/server/meeting-transcripts.service';

const ListSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
});

const CreateSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.enum(['paste', 'upload']).optional(),
  file_path: z.string().nullable().optional(),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

const UpdateSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional(),
  transcriptId: z.string().uuid(),
  title: z.string().min(1).optional(),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

const DeleteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional(),
  transcriptId: z.string().uuid(),
});

const GetSchema = z.object({
  accountId: z.string().uuid(),
  transcriptId: z.string().uuid(),
});

function getService() {
  return createMeetingTranscriptsService(getSupabaseServerClient());
}

function revalidateMeetingPages(accountSlug: string, transcriptId?: string) {
  const slug = accountSlug.trim();
  if (!slug) return;

  revalidatePath(workAccountPath(pathsConfig.app.accountMeetings, slug), 'page');

  if (transcriptId) {
    revalidatePath(
      workAccountPath(pathsConfig.app.accountMeetingDetail, slug).replace(
        '[transcriptId]',
        transcriptId,
      ),
      'page',
    );
  }
}

export const listMeetingTranscripts = enhanceAction(
  async (input) => {
    const service = getService();
    if (input.clientId) {
      return service.listForClient({
        accountId: input.accountId,
        clientId: input.clientId,
      });
    }
    if (input.dealId) {
      return service.listForDeal({
        accountId: input.accountId,
        dealId: input.dealId,
      });
    }
    return service.listForAccount({ accountId: input.accountId });
  },
  { schema: ListSchema },
);

export const getMeetingTranscript = enhanceAction(
  async (input) =>
    getService().getById({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    }),
  { schema: GetSchema },
);

export const createMeetingTranscript = enhanceAction(
  async (input) => {
    const row = await getService().create({
      accountId: input.accountId,
      clientId: input.clientId,
      dealId: input.dealId,
      title: input.title,
      content: input.content,
      source: input.source ?? 'paste',
      filePath: input.file_path ?? null,
      meetingDate: input.meetingDate ?? null,
    });

    if (input.accountSlug) {
      revalidateMeetingPages(input.accountSlug, row.id);
    }

    return row;
  },
  { schema: CreateSchema },
);

export const updateMeetingTranscript = enhanceAction(
  async (input) => {
    const row = await getService().update({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
      title: input.title,
      meetingDate: input.meetingDate,
    });

    if (input.accountSlug) {
      revalidateMeetingPages(input.accountSlug, input.transcriptId);
    }

    return row;
  },
  { schema: UpdateSchema },
);

export const deleteMeetingTranscript = enhanceAction(
  async (input) => {
    await getService().delete({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    });

    if (input.accountSlug) {
      revalidateMeetingPages(input.accountSlug);
    }
  },
  { schema: DeleteSchema },
);
