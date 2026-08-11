'use server';

import { headers } from 'next/headers';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { isRateLimited } from '~/lib/rate-limit/in-memory';

const BrochureEnquireSchema = z.object({
  token: z.string().min(16).max(128),
  contactName: z.string().min(1).max(120),
  contactEmail: z.string().email().max(320),
  contactPhone: z.string().max(40).optional().nullable().or(z.literal('')),
  message: z.string().max(2000).optional().nullable().or(z.literal('')),
  /** Honeypot — bots fill this; humans leave empty. */
  website: z.string().max(200).optional().or(z.literal('')),
});

export const submitBrochureEnquiry = enhanceAction(
  async (input) => {
    if (input.website) {
      return { success: true };
    }

    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for');
    const ip =
      forwarded?.split(',')[0]?.trim() ||
      headerStore.get('x-real-ip')?.trim() ||
      'unknown';

    if (isRateLimited(`brochure-enquire:${input.token}:${ip}`, 8)) {
      throw new Error('Too many enquiries. Please try again shortly.');
    }

    // Token-gated public action — admin client (matches /share/listing pattern).
    // Generated DB types lag migrations; cast keeps lookups workable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getSupabaseServerAdminClient() as any;

    const { data: listing, error } = await admin
      .from('commercial_listings')
      .select('id, account_id')
      .eq('brochure_share_token', input.token)
      .eq('brochure_share_enabled', true)
      .maybeSingle();

    if (error || !listing) {
      throw new Error('This brochure link is invalid or has been disabled.');
    }

    const row = listing as { id: string; account_id: string };

    const { error: insertError } = await admin
      .from('commercial_enquiries')
      .insert({
        account_id: row.account_id,
        listing_id: row.id,
        contact_name: input.contactName.trim(),
        contact_email: input.contactEmail.trim(),
        contact_phone: input.contactPhone?.trim() || null,
        message: input.message?.trim() || null,
        source: 'brochure',
        status: 'unactioned',
        received_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[brochure] enquire insert error:', insertError.message);
      throw new Error('Could not send your enquiry. Please try again.');
    }

    return { success: true };
  },
  {
    schema: BrochureEnquireSchema,
    auth: false,
  },
);
