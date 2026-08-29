'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { circulateContactDigests } from '~/lib/commercial/circulation/circulate-digest';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';

import {
  CirculationAutoSendSchema,
  CirculationContactAutoSendSchema,
  CirculationRunSchema,
} from '../schemas/circulation-workspace.schema';

function getClient() {
  return getSupabaseServerClient();
}

async function requireActor(accountId: string) {
  const { requireCommercialBillableActor } =
    await import('~/lib/commercial/require-commercial-billable-actor');
  await requireCommercialBillableActor(accountId, 'manage circulation');
}

export const setCirculationAutoSend = enhanceAction(
  async (input) => {
    await requireActor(input.accountId);
    const result = await createCommercialCirculationService(
      getClient(),
    ).setAutoSendEnabled(input.accountId, input.enabled);
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: CirculationAutoSendSchema },
);

export const setCirculationContactAutoSend = enhanceAction(
  async (input) => {
    await requireActor(input.accountId);
    await createCommercialCirculationService(getClient()).setContactAutoSend(
      input,
    );
    revalidatePath('/home', 'layout');
    return { ok: true };
  },
  { schema: CirculationContactAutoSendSchema },
);

export const runCirculationDigest = enhanceAction(
  async (input, user) => {
    await requireActor(input.accountId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!siteUrl) {
      throw new Error('NEXT_PUBLIC_SITE_URL is not configured');
    }

    const result = await circulateContactDigests(getClient(), {
      accountId: input.accountId,
      siteUrl,
      sentBy: user.id,
      dryRun: input.dryRun,
      sendTrigger: input.dryRun ? 'dry_run' : 'manual',
      autoEligibility: true,
    });
    revalidatePath('/home', 'layout');
    return result;
  },
  { schema: CirculationRunSchema },
);
