'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ListClientRetainerSummarySchema } from '../schema/client-retainer-summary.schema';
import { createClientRetainerSummaryService } from './client-retainer-summary.service';

export const listClientRetainerSummaryAction = enhanceAction(
  async (input) =>
    createClientRetainerSummaryService(getSupabaseServerClient()).list(
      input.accountId,
      input.clientId,
    ),
  { auth: true, schema: ListClientRetainerSummarySchema },
);
