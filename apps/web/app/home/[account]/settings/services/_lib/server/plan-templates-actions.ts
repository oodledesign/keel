'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AttachHostingPlanSchema,
  AttachRetainerPlanSchema,
  CancelClientSubscriptionSchema,
  DeletePlanTemplateSchema,
  ListClientSubscriptionsSchema,
  ListPlanTemplatesSchema,
  ResendClientSubscriptionPaymentLinkSchema,
  UpsertPlanTemplateSchema,
} from '../schema/plan-templates.schema';
import { createPlanTemplatesService } from './plan-templates.service';

function getService() {
  return createPlanTemplatesService(getSupabaseServerClient());
}

export const listPlanTemplatesAction = enhanceAction(
  async (input) =>
    getService().listTemplates(input.accountId, {
      kind: input.kind,
      activeOnly: input.activeOnly,
    }),
  { schema: ListPlanTemplatesSchema },
);

export const upsertPlanTemplateAction = enhanceAction(
  async (input) => {
    const result = await getService().upsertTemplate(input);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { schema: UpsertPlanTemplateSchema },
);

export const deletePlanTemplateAction = enhanceAction(
  async (input) => {
    const result = await getService().deleteTemplate(input.accountId, input.id);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { schema: DeletePlanTemplateSchema },
);

export const attachHostingPlanAction = enhanceAction(
  async (input) => {
    const service = getService();
    let planTemplateId = input.planTemplateId;
    if (!planTemplateId && input.newTemplate) {
      const created = await service.upsertTemplate({
        accountId: input.accountId,
        ...input.newTemplate,
        kind: 'hosting',
      });
      planTemplateId = created.id;
    }
    if (!planTemplateId) {
      throw new Error('Choose or create a hosting plan');
    }

    const db = getSupabaseServerClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- G2 pending typegen

    const { data: website } = await db
      .from('websites')
      .select('id, client_org_id')
      .eq('id', input.websiteId)
      .eq('business_id', input.accountId)
      .maybeSingle();

    if (!website) throw new Error('Website not found');

    const orgId = website.client_org_id as string | null;
    if (!orgId) {
      throw new Error('Link a client to this website before adding hosting');
    }

    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('client_org_id', orgId)
      .limit(1)
      .maybeSingle();

    if (!client?.id) {
      throw new Error('No client record found for this website’s organisation');
    }

    const result = await service.attachPlan({
      accountId: input.accountId,
      planTemplateId,
      clientId: String(client.id),
      websiteId: input.websiteId,
    });

    revalidatePath('/home/[account]/websites', 'layout');
    return result;
  },
  { schema: AttachHostingPlanSchema },
);

export const attachRetainerPlanAction = enhanceAction(
  async (input) => {
    const service = getService();
    let planTemplateId = input.planTemplateId;
    if (!planTemplateId && input.newTemplate) {
      const created = await service.upsertTemplate({
        accountId: input.accountId,
        ...input.newTemplate,
        kind: input.newTemplate.kind ?? 'retainer',
      });
      planTemplateId = created.id;
    }
    if (!planTemplateId) {
      throw new Error('Choose or create a retainer plan');
    }

    const result = await service.attachPlan({
      accountId: input.accountId,
      planTemplateId,
      clientId: input.clientId,
      websiteId: null,
    });

    revalidatePath('/home/[account]/clients', 'layout');
    return result;
  },
  { schema: AttachRetainerPlanSchema },
);

export const cancelClientSubscriptionAction = enhanceAction(
  async (input) => {
    const result = await getService().cancelSubscription(
      input.accountId,
      input.subscriptionId,
    );
    revalidatePath('/home/[account]/clients', 'layout');
    revalidatePath('/home/[account]/websites', 'layout');
    return result;
  },
  { schema: CancelClientSubscriptionSchema },
);

export const listClientSubscriptionsAction = enhanceAction(
  async (input) =>
    getService().listSubscriptions(input.accountId, {
      clientId: input.clientId,
      websiteId: input.websiteId,
    }),
  { schema: ListClientSubscriptionsSchema },
);

export const resendClientSubscriptionPaymentLinkAction = enhanceAction(
  async (input) => {
    const result = await getService().resendPaymentLink(
      input.accountId,
      input.subscriptionId,
    );
    revalidatePath('/home/[account]/clients', 'layout');
    revalidatePath('/home/[account]/websites', 'layout');
    return result;
  },
  { schema: ResendClientSubscriptionPaymentLinkSchema },
);
