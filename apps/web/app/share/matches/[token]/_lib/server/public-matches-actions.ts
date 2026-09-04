'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { updatePublicRequirementByToken } from '~/lib/commercial/circulation/public-matches';
import { COMMERCIAL_PROPERTY_TYPES } from '~/lib/commercial/commercial-constants';
import { isRateLimited } from '~/lib/rate-limit/in-memory';

const PublicMatchesSettingsSchema = z.object({
  token: z.string().min(16).max(128),
  unsubscribed: z.boolean(),
  notifyOnNewMatch: z.boolean(),
});

const propertyTypeEnum = z.enum(
  COMMERCIAL_PROPERTY_TYPES as unknown as [string, ...string[]],
);

const PublicMatchRequirementSchema = z
  .object({
    token: z.string().min(16).max(128),
    sector: propertyTypeEnum.nullable(),
    tenure: z.enum(['rent', 'buy', 'both']).nullable(),
    locationText: z.string().max(300).nullable(),
    searchRadiusMiles: z.number().min(0).max(100).nullable(),
    sizeMinSqft: z.number().nonnegative().nullable(),
    sizeMaxSqft: z.number().nonnegative().nullable(),
    budgetMinPence: z.number().int().nonnegative().nullable(),
    budgetMaxPence: z.number().int().nonnegative().nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.sizeMinSqft != null &&
      value.sizeMaxSqft != null &&
      value.sizeMinSqft > value.sizeMaxSqft
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum size cannot be greater than maximum size.',
        path: ['sizeMinSqft'],
      });
    }
    if (
      value.budgetMinPence != null &&
      value.budgetMaxPence != null &&
      value.budgetMinPence > value.budgetMaxPence
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum budget cannot be greater than maximum budget.',
        path: ['budgetMinPence'],
      });
    }
  });

function clientIpFromHeaders(headerStore: Headers): string {
  const forwarded = headerStore.get('x-forwarded-for');
  return (
    forwarded?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export const updatePublicMatchSettings = enhanceAction(
  async (input) => {
    const headerStore = await headers();
    const ip = clientIpFromHeaders(headerStore);

    if (isRateLimited(`matches-settings:${input.token}:${ip}`, 20)) {
      throw new Error('Too many updates. Please try again shortly.');
    }

    const admin = getSupabaseServerAdminClient();
    const circulation = createCommercialCirculationService(admin);
    const preference = await circulation.loadPreferenceByPublicToken(
      input.token,
    );
    if (!preference) {
      throw new Error('This link is invalid or has expired.');
    }
    if (preference.marketingStatus === 'suppressed') {
      throw new Error('This address cannot be re-subscribed.');
    }

    await circulation.updatePublicPreference({
      accountId: preference.accountId,
      email: preference.email,
      unsubscribed: input.unsubscribed,
      notifyOnNewMatch: input.unsubscribed ? false : input.notifyOnNewMatch,
    });

    return { ok: true };
  },
  { auth: false, schema: PublicMatchesSettingsSchema },
);

export const updatePublicMatchRequirement = enhanceAction(
  async (input) => {
    const headerStore = await headers();
    const ip = clientIpFromHeaders(headerStore);

    if (isRateLimited(`matches-requirement:${input.token}:${ip}`, 20)) {
      throw new Error('Too many updates. Please try again shortly.');
    }

    const admin = getSupabaseServerAdminClient();
    const requirement = await updatePublicRequirementByToken(
      admin,
      input.token,
      {
        sector: input.sector,
        tenure: input.tenure,
        locationText: input.locationText,
        searchRadiusMiles: input.searchRadiusMiles,
        sizeMinSqft: input.sizeMinSqft,
        sizeMaxSqft: input.sizeMaxSqft,
        budgetMinPence: input.budgetMinPence,
        budgetMaxPence: input.budgetMaxPence,
      },
    );

    revalidatePath(`/share/matches/${input.token}`);

    return { ok: true as const, requirement };
  },
  { auth: false, schema: PublicMatchRequirementSchema },
);
