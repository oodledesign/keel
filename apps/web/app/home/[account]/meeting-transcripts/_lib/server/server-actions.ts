'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import {
  createMeetingTranscriptsService,
} from '../../../_lib/server/meeting-transcripts.service';

const ListSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
});

const CreateSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.enum(['paste', 'upload']).optional(),
  file_path: z.string().nullable().optional(),
});

const DeleteSchema = z.object({
  accountId: z.string().uuid(),
  transcriptId: z.string().uuid(),
});

function getService() {
  return createMeetingTranscriptsService(getSupabaseServerClient());
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
    return [];
  },
  { schema: ListSchema },
);

export const createMeetingTranscript = enhanceAction(
  async (input) =>
    getService().create({
      accountId: input.accountId,
      clientId: input.clientId,
      dealId: input.dealId,
      title: input.title,
      content: input.content,
      source: input.source ?? 'paste',
      filePath: input.file_path ?? null,
    }),
  { schema: CreateSchema },
);

export const deleteMeetingTranscript = enhanceAction(
  async (input) =>
    getService().delete({
      accountId: input.accountId,
      transcriptId: input.transcriptId,
    }),
  { schema: DeleteSchema },
);
