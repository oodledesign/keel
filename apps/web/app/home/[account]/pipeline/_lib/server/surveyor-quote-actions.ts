'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { createProposalsService } from '~/home/[account]/proposals/_lib/server/proposals.service';
import { buildSurveyorQuoteHtml } from '~/lib/building-surveyor/survey-quote';

const CreateSurveyorQuoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  dealId: z.string().uuid(),
  address: z.string().min(1).max(500),
  clientName: z.string().max(200).optional(),
  firmName: z.string().max(200).optional(),
});

export const createSurveyorQuoteAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('name, space_type')
      .eq('id', data.accountId)
      .maybeSingle();
    if (
      (account as { space_type?: string } | null)?.space_type !==
      'building-surveyor'
    ) {
      throw new Error(
        'Quotes of this type are only available in a building-surveyor workspace',
      );
    }

    const html = buildSurveyorQuoteHtml({
      address: data.address,
      clientName: data.clientName?.trim() || 'Client',
      firmName:
        data.firmName?.trim() ||
        (account as { name?: string | null } | null)?.name?.trim() ||
        'Surveyor',
    });

    const proposal = await createProposalsService(client).createProposal({
      accountId: data.accountId,
      deal_id: data.dealId,
      title: `Quote — ${data.address.trim()}`,
      content_html: html,
      kind: 'proposal',
      survey_property_address: data.address.trim(),
    });

    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', data.accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountProposals.replace('[account]', data.accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountContracts.replace('[account]', data.accountSlug),
    );

    return { proposalId: proposal.id };
  },
  { schema: CreateSurveyorQuoteSchema },
);
