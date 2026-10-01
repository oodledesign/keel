'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { createProposalsService } from '~/home/[account]/proposals/_lib/server/proposals.service';
import { createSurveyReportDetailsService } from '~/home/[account]/surveys/_lib/server/survey-report-details.service';
import {
  DroneBillingSchema,
  DroneFeePenceSchema,
  droneQuoteLine,
} from '~/lib/building-surveyor/survey-drone';
import { buildSurveyorQuoteHtml } from '~/lib/building-surveyor/survey-quote';
import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';

const CreateSurveyorQuoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  dealId: z.string().uuid(),
  address: z.string().min(1).max(500),
  clientName: z.string().max(200).optional(),
  firmName: z.string().max(200).optional(),
  droneUsed: z.boolean().optional(),
  droneBilling: DroneBillingSchema.optional(),
  /** Omit to use the workspace default fee. */
  droneFeePence: DroneFeePenceSchema.optional(),
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

    const droneUsed = data.droneUsed === true;
    const droneBilling = data.droneBilling ?? 'separate';
    const defaultFeePence = droneUsed
      ? await createSurveyReportDetailsService(client).getDroneDefaultFee(
          data.accountId,
        )
      : 0;
    // The fee is fixed on the quote when it is made, so later changes to the
    // workspace default do not alter a quote that has already been issued.
    const droneFeePence =
      droneBilling === 'separate'
        ? (data.droneFeePence ?? defaultFeePence)
        : null;
    const currency = droneUsed
      ? await getWorkspaceCurrencyWithClient(client, data.accountId)
      : undefined;
    const droneLine = droneQuoteLine({
      currency,
      drone: {
        used: droneUsed,
        billing: droneBilling,
        feePence: droneFeePence,
      },
      defaultFeePence,
    });

    const html = buildSurveyorQuoteHtml({
      address: data.address,
      clientName: data.clientName?.trim() || 'Client',
      firmName:
        data.firmName?.trim() ||
        (account as { name?: string | null } | null)?.name?.trim() ||
        'Surveyor',
      extraLines: droneLine ? [droneLine] : [],
    });

    const proposal = await createProposalsService(client).createProposal({
      accountId: data.accountId,
      deal_id: data.dealId,
      title: `Quote — ${data.address.trim()}`,
      content_html: html,
      kind: 'proposal',
      survey_property_address: data.address.trim(),
      survey_drone_used: droneUsed,
      survey_drone_billing: droneBilling,
      survey_drone_fee_pence: droneFeePence,
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
