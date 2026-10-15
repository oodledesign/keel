'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { createProposalsService } from '~/home/[account]/proposals/_lib/server/proposals.service';
import { createSurveyReportDetailsService } from '~/home/[account]/surveys/_lib/server/survey-report-details.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { resolveTradingOrAccountName } from '~/lib/brand/trading-name';
import { assertBuildingSurveyorAccount } from '~/lib/building-surveyor/assert-building-surveyor.server';
import { hashQuoteHtml } from '~/lib/building-surveyor/lead-sync';
import {
  loadFirmName,
  loadLeadSyncSource,
} from '~/lib/building-surveyor/lead-sync.server';
import {
  DroneBillingSchema,
  DroneFeePenceSchema,
  mapSurveyDrone,
} from '~/lib/building-surveyor/survey-drone';
import {
  quoteAddressForLead,
  renderSurveyorQuoteHtml,
} from '~/lib/building-surveyor/surveyor-quote-content.server';
import { resolveQuoteLetterHtml } from '~/lib/building-surveyor/surveyor-quote-letters';
import {
  type SurveyorTobLeadContext,
  applyLeadSmartFields,
  buildSurveyorLeadSmartFields,
} from '~/lib/building-surveyor/surveyor-tob-content';
import { loadSurveyorTobSettings } from '~/lib/building-surveyor/surveyor-tob.server';

const CreateSurveyorQuoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  dealId: z.string().uuid(),
  /** Omit to use the lead's property address. */
  address: z.string().max(500).optional(),
  clientName: z.string().max(200).optional(),
  firmName: z.string().max(200).optional(),
  droneUsed: z.boolean().optional(),
  droneBilling: DroneBillingSchema.optional(),
  /** Omit to use the workspace default fee. */
  droneFeePence: DroneFeePenceSchema.optional(),
});

// Quote-hash columns are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getSupabaseServerClient();
}

function revalidateQuotePaths(accountSlug: string) {
  revalidatePath(
    pathsConfig.app.accountPipeline.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountProposals.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountContracts.replace('[account]', accountSlug),
  );
}

export const createSurveyorQuoteAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    await assertBuildingSurveyorAccount(
      data.accountId,
      'Quotes of this type are only available in a building-surveyor workspace',
    );

    const lead = await loadLeadSyncSource(data.accountId, data.dealId);
    if (!lead) throw new Error('Lead not found');
    const address = data.address?.trim() || quoteAddressForLead(lead);
    if (!address) {
      throw new Error('Add the property address to the lead first');
    }
    const quoteLead = {
      ...lead,
      contactName: data.clientName?.trim() || lead.contactName,
    };

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

    const tobSettings = await loadSurveyorTobSettings(data.accountId);
    const brand = await loadAccountBrandResolved(data.accountId);
    const firmName =
      data.firmName?.trim() ||
      resolveTradingOrAccountName({
        tradingName: brand.trading_name,
        accountName: await loadFirmName(data.accountId),
      });
    const letter = resolveQuoteLetterHtml({
      surveyType: lead.surveyType,
      overrides: tobSettings.quoteTemplates,
    });
    const leadCtx: SurveyorTobLeadContext = {
      dealId: data.dealId,
      contactName: quoteLead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone ?? null,
      clientAddress: lead.clientAddress ?? null,
      surveyType: lead.surveyType,
      inspectionAt: lead.inspectionAt ?? null,
      value: lead.value,
      addressLine1: lead.addressLine1 ?? null,
      addressLine2: lead.addressLine2 ?? null,
      town: lead.town ?? null,
      postcode: lead.postcode ?? null,
      name: lead.name ?? null,
    };
    let html = applyLeadSmartFields(
      letter,
      buildSurveyorLeadSmartFields({
        lead: leadCtx,
        accountName: firmName,
        signatoryName: tobSettings.tobSignatoryName,
        signatoryTitle: tobSettings.tobSignatoryTitle,
      }),
    );
    if (droneUsed) {
      const droneBlock = await renderSurveyorQuoteHtml({
        client,
        accountId: data.accountId,
        firmName,
        lead: quoteLead,
        address: data.address,
        drone: {
          used: droneUsed,
          billing: droneBilling,
          feePence: droneFeePence,
        },
        defaultDroneFeePence: defaultFeePence,
      });
      const droneMatch = droneBlock.match(
        /<h2>Additional services<\/h2>[\s\S]*?<\/table>/,
      );
      if (droneMatch) {
        html = `${html}\n${droneMatch[0]}`;
      }
    }

    const proposal = await createProposalsService(client).createProposal({
      accountId: data.accountId,
      deal_id: data.dealId,
      title: `Quote — ${address}`,
      content_html: html,
      kind: 'proposal',
      recipient_name: quoteLead.contactName?.trim() || null,
      recipient_email: lead.contactEmail?.trim() || null,
      total_pence:
        lead.value !== null && lead.value > 0
          ? Math.round(lead.value * 100)
          : null,
      survey_drone_used: droneUsed,
      survey_drone_billing: droneBilling,
      survey_drone_fee_pence: droneFeePence,
    });

    // Only a quote generated from the lead tracks it; a typed address is the
    // legacy path and keeps the body as written.
    const { error: hashError } = await db()
      .from('proposals')
      .update({
        survey_property_address: address,
        survey_property_postcode: lead.postcode?.trim() || null,
        survey_type: lead.surveyType,
        quote_html_hash: data.address?.trim() ? null : hashQuoteHtml(html),
      })
      .eq('id', proposal.id)
      .eq('account_id', data.accountId);
    if (hashError) {
      console.error('[surveyor-quote] lead link failed', hashError.message);
    }

    revalidateQuotePaths(data.accountSlug);

    return { proposalId: proposal.id };
  },
  { schema: CreateSurveyorQuoteSchema },
);

const ResolveQuoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  proposalId: z.string().uuid(),
  /** Regenerate from the lead, or keep the edited body and clear the banner. */
  resolution: z.enum(['regenerate', 'keep']),
});

/** Answers the "Lead details changed since this quote was drafted" banner. */
export const resolveSurveyorQuoteLeadChangeAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    await assertBuildingSurveyorAccount(
      data.accountId,
      'Quotes of this type are only available in a building-surveyor workspace',
    );

    const { data: row, error } = await db()
      .from('proposals')
      .select(
        'id, deal_id, status, kind, survey_drone_used, survey_drone_billing, survey_drone_fee_pence',
      )
      .eq('id', data.proposalId)
      .eq('account_id', data.accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const proposal = row as
      | (Record<string, unknown> & {
          deal_id: string | null;
          status: string;
          kind: string;
        })
      | null;
    if (!proposal?.deal_id || proposal.kind === 'survey_report') {
      throw new Error('Quote not found');
    }
    if (proposal.status !== 'draft') {
      throw new Error('This quote has been sent and can no longer change');
    }

    const lead = await loadLeadSyncSource(data.accountId, proposal.deal_id);
    if (!lead) throw new Error('Lead not found');
    const html = await renderSurveyorQuoteHtml({
      client,
      accountId: data.accountId,
      firmName: await loadFirmName(data.accountId),
      lead,
      drone: mapSurveyDrone(proposal),
    });

    const patch: Record<string, unknown> = {
      quote_html_hash: hashQuoteHtml(html),
      lead_changed_at: null,
    };
    if (data.resolution === 'regenerate') patch.content_html = html;

    const { error: updateError } = await db()
      .from('proposals')
      .update(patch)
      .eq('id', data.proposalId)
      .eq('account_id', data.accountId)
      .eq('status', 'draft');
    if (updateError) throw new Error(updateError.message);

    revalidateQuotePaths(data.accountSlug);
    revalidatePath(
      pathsConfig.app.accountProposalEdit
        .replace('[account]', data.accountSlug)
        .replace('[id]', data.proposalId),
    );
    return { ok: true as const };
  },
  { schema: ResolveQuoteSchema },
);
