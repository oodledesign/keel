'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertBuildingSurveyorAccount } from '~/lib/building-surveyor/assert-building-surveyor.server';
import type { SurveyorLeadEvent } from '~/lib/building-surveyor/lead-activity';

const LeadScopeSchema = z.object({
  accountId: z.string().uuid(),
  dealId: z.string().uuid(),
});

// pipeline_deal_events and the lead columns are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getSupabaseServerClient();
}

async function assertBuildingSurveyor(accountId: string) {
  await assertBuildingSurveyorAccount(
    accountId,
    'Leads are only available in a building-surveyor workspace',
  );
}

async function memberNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data } = await db()
    .from('accounts')
    .select('id, name')
    .in('id', unique);
  for (const row of (data ?? []) as Array<{
    id: string;
    name?: string | null;
  }>) {
    names.set(row.id, row.name?.trim() || 'Member');
  }
  return names;
}

export const listSurveyorLeadEventsAction = enhanceAction(
  async (input): Promise<SurveyorLeadEvent[]> => {
    await assertBuildingSurveyor(input.accountId);
    const { data, error } = await db()
      .from('pipeline_deal_events')
      .select(
        'id, event_type, from_stage, to_stage, detail, actor_id, created_at',
      )
      .eq('account_id', input.accountId)
      .eq('deal_id', input.dealId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      id: string;
      event_type: string;
      from_stage: string | null;
      to_stage: string | null;
      detail: Record<string, unknown> | null;
      actor_id: string | null;
      created_at: string;
    }>;
    const names = await memberNames(
      rows.flatMap((row) => {
        const checkedBy =
          row.detail?.tick === 'reportCheckedBy' &&
          typeof row.detail.value === 'string'
            ? [row.detail.value]
            : [];
        return [...(row.actor_id ? [row.actor_id] : []), ...checkedBy];
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      fromStage: row.from_stage,
      toStage: row.to_stage,
      detail: row.detail ?? {},
      actorName: row.actor_id ? (names.get(row.actor_id) ?? 'Member') : null,
      detailMemberName:
        row.detail?.tick === 'reportCheckedBy' &&
        typeof row.detail.value === 'string'
          ? (names.get(row.detail.value) ?? null)
          : null,
      createdAt: row.created_at,
    }));
  },
  { schema: LeadScopeSchema },
);

export type SurveyorLeadDocument = {
  id: string;
  kind: 'proposal' | 'survey_report' | 'terms_of_business';
  title: string;
  status: string;
  leadChangedAt: string | null;
  /** Storage path for signed ToB PDF when present. */
  signedPdfPath?: string | null;
};

export const listSurveyorLeadDocumentsAction = enhanceAction(
  async (input): Promise<SurveyorLeadDocument[]> => {
    await assertBuildingSurveyor(input.accountId);
    const [{ data, error }, { data: contracts, error: contractError }] =
      await Promise.all([
        db()
          .from('proposals')
          .select('id, kind, title, status, lead_changed_at, created_at')
          .eq('account_id', input.accountId)
          .eq('deal_id', input.dealId)
          .order('created_at', { ascending: false })
          .limit(20),
        db()
          .from('contracts')
          .select(
            'id, title, status, signed_pdf_path, created_at, is_terms_of_business',
          )
          .eq('account_id', input.accountId)
          .eq('deal_id', input.dealId)
          .eq('is_terms_of_business', true)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
    if (error) throw new Error(error.message);
    if (contractError) {
      console.error('[lead-documents] contracts', contractError.message);
    }

    const proposalDocs = (
      (data ?? []) as Array<{
        id: string;
        kind: string | null;
        title: string | null;
        status: string | null;
        lead_changed_at: string | null;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      kind: (row.kind === 'survey_report'
        ? 'survey_report'
        : 'proposal') as SurveyorLeadDocument['kind'],
      title: row.title?.trim() || 'Untitled',
      status: row.status ?? 'draft',
      leadChangedAt: row.lead_changed_at,
      createdAt: row.created_at,
    }));

    const tobDocs = (
      (contracts ?? []) as Array<{
        id: string;
        title: string | null;
        status: string | null;
        signed_pdf_path: string | null;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      kind: 'terms_of_business' as const,
      title: row.title?.trim() || 'Terms of business',
      status: row.status ?? 'draft',
      leadChangedAt: null as string | null,
      signedPdfPath: row.signed_pdf_path,
      createdAt: row.created_at,
    }));

    return [...proposalDocs, ...tobDocs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ createdAt: _createdAt, ...doc }) => doc);
  },
  { schema: LeadScopeSchema },
);

const MarkLostSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  dealIds: z.array(z.string().uuid()).min(1).max(200),
  /** Archived from the unresponsive-lead prompt (logs an archived event). */
  archived: z.boolean().optional(),
});

export const markSurveyorLeadsLostAction = enhanceAction(
  async (input, user) => {
    await assertBuildingSurveyor(input.accountId);
    const now = new Date().toISOString();
    const { data, error } = await db()
      .from('pipeline_deals')
      .update({ stage: 'lost', lost_at: now })
      .eq('account_id', input.accountId)
      .in('id', input.dealIds)
      .select('id');
    if (error) throw new Error(error.message);

    const updatedIds = ((data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );
    if (input.archived && updatedIds.length > 0) {
      const { error: eventError } = await db()
        .from('pipeline_deal_events')
        .insert(
          updatedIds.map((dealId) => ({
            account_id: input.accountId,
            deal_id: dealId,
            event_type: 'archived',
            to_stage: 'lost',
            actor_id: user.id,
          })),
        );
      if (eventError) {
        console.error('[surveyor-lead] archive event failed', eventError);
      }
    }

    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', input.accountSlug),
    );
    return { updatedIds, lostAt: now };
  },
  { schema: MarkLostSchema },
);

const SendTermsSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  dealId: z.string().uuid(),
});

export const sendSurveyorTermsAction = enhanceAction(
  async (input) => {
    await assertBuildingSurveyor(input.accountId);
    const { sendSurveyorTermsForDeal } =
      await import('~/lib/building-surveyor/surveyor-tob.server');
    const result = await sendSurveyorTermsForDeal({
      accountId: input.accountId,
      dealId: input.dealId,
      client: db(),
    });
    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', input.accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountContracts.replace('[account]', input.accountSlug),
    );
    return result;
  },
  { schema: SendTermsSchema },
);

const LinkSurveySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  dealId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

export const linkSurveyToLeadAction = enhanceAction(
  async (input) => {
    await assertBuildingSurveyor(input.accountId);
    const { data: survey, error: surveyError } = await db()
      .from('proposals')
      .select('id, deal_id, kind')
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report')
      .maybeSingle();
    if (surveyError || !survey) throw new Error('Survey not found');
    if ((survey as { deal_id?: string | null }).deal_id) {
      throw new Error('That survey is already linked to a lead');
    }

    const { error } = await db()
      .from('proposals')
      .update({ deal_id: input.dealId })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);

    revalidatePath(
      pathsConfig.app.accountPipeline.replace('[account]', input.accountSlug),
    );
    revalidatePath(
      pathsConfig.app.accountSurveys.replace('[account]', input.accountSlug),
    );
    return { ok: true };
  },
  { schema: LinkSurveySchema },
);

const ListUnlinkedSurveysSchema = z.object({
  accountId: z.string().uuid(),
});

export const listUnlinkedSurveysAction = enhanceAction(
  async (input) => {
    await assertBuildingSurveyor(input.accountId);
    const { data, error } = await db()
      .from('proposals')
      .select('id, title, survey_property_address, status, created_at')
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report')
      .is('deal_id', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (
      (data ?? []) as Array<{
        id: string;
        title: string | null;
        survey_property_address: string | null;
        status: string | null;
        created_at: string;
      }>
    ).map((row) => ({
      id: row.id,
      title: row.title?.trim() || 'Untitled survey',
      address: row.survey_property_address?.trim() || null,
      status: row.status,
      createdAt: row.created_at,
    }));
  },
  { schema: ListUnlinkedSurveysSchema },
);
