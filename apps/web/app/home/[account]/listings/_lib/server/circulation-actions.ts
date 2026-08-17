'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  circulateListing,
  listCirculationCandidates,
} from '~/lib/commercial/circulation/circulate-listing';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';

const AccountIdSchema = z.object({
  accountId: z.string().uuid(),
});

const UpdateFormSchema = z.object({
  accountId: z.string().uuid(),
  enabled: z.boolean().optional(),
  privacyPolicyUrl: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .refine((v) => v == null || v === '' || /^https?:\/\//i.test(v), {
      message: 'Privacy URL must be http(s)',
    }),
  successMessage: z.string().max(500).nullable().optional(),
  title: z.string().min(1).max(120).optional(),
  intro: z.string().max(2000).nullable().optional(),
});

const ListCandidatesSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  minScore: z.number().min(0).max(100).optional(),
});

const CirculateSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  requirementIds: z.array(z.string().uuid()).min(1).max(200),
  fromEmail: z.string().email(),
  fromName: z.string().max(120).optional(),
  replyTo: z.string().email().optional(),
});

function getClient() {
  return getSupabaseServerClient();
}

export const getRequirementFormSettings = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return createCommercialCirculationService(
      getClient(),
    ).getOrCreateRequirementForm(input.accountId);
  },
  { schema: AccountIdSchema },
);

export const updateRequirementFormSettings = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return createCommercialCirculationService(getClient()).updateRequirementForm(
      input.accountId,
      {
        enabled: input.enabled,
        privacyPolicyUrl: input.privacyPolicyUrl,
        successMessage: input.successMessage,
        title: input.title,
        intro: input.intro,
      },
    );
  },
  { schema: UpdateFormSchema },
);

export const listListingCirculationCandidates = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );
    return listCirculationCandidates(getClient(), input);
  },
  { schema: ListCandidatesSchema },
);

export const circulateListingAction = enhanceAction(
  async (input, user) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'create or edit disposals',
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!siteUrl) {
      throw new Error('NEXT_PUBLIC_SITE_URL is not configured');
    }

    return circulateListing(getClient(), {
      accountId: input.accountId,
      listingId: input.listingId,
      requirementIds: input.requirementIds,
      sentBy: user.id,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      replyTo: input.replyTo,
      siteUrl,
    });
  },
  { schema: CirculateSchema },
);
