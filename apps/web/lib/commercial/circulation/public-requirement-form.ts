import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CONSENT_COPY_VERSION,
  createCommercialCirculationService,
} from '~/lib/commercial/circulation/circulation.service';
import { geocodeListingAddress } from '~/lib/commercial/geocode-listing';

export type PublicRequirementForm = {
  token: string;
  accountId: string;
  accountName: string;
  title: string;
  intro: string | null;
  privacyPolicyUrl: string | null;
  successMessage: string | null;
  consentCopyVersion: string;
};

export type RequirementFormSubmission = {
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  companyName?: string | null;
  sector?: string | null;
  tenure?: 'rent' | 'buy' | 'both' | null;
  locationText?: string | null;
  sizeMinSqft?: number | null;
  sizeMaxSqft?: number | null;
  budgetMinPence?: number | null;
  budgetMaxPence?: number | null;
  notes?: string | null;
};

/**
 * Load enabled public form by token (admin client — no anon RLS).
 */
export async function loadPublicRequirementFormByToken(
  admin: SupabaseClient,
  token: string,
): Promise<PublicRequirementForm | null> {
  if (!token || token.length < 16) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form, error } = await (admin as any)
    .from('commercial_requirement_forms')
    .select('*')
    .eq('share_token', token)
    .eq('enabled', true)
    .maybeSingle();

  if (error || !form) return null;

  const { data: account } = await admin
    .from('accounts')
    .select('name')
    .eq('id', form.account_id)
    .maybeSingle();

  return {
    token,
    accountId: form.account_id as string,
    accountName:
      (account as { name?: string | null } | null)?.name?.trim() || 'Agency',
    title: (form.title as string) || 'Register your requirement',
    intro: (form.intro as string | null) ?? null,
    privacyPolicyUrl: (form.privacy_policy_url as string | null) ?? null,
    successMessage: (form.success_message as string | null) ?? null,
    consentCopyVersion:
      (form.consent_copy_version as string) || CONSENT_COPY_VERSION,
  };
}

/**
 * Create or update requirement from public embed; respects unsubscribe.
 */
export async function upsertRequirementFromPublicForm(
  admin: SupabaseClient,
  form: PublicRequirementForm,
  submission: RequirementFormSubmission,
): Promise<{ requirementId: string; created: boolean }> {
  const email = submission.contactEmail.trim().toLowerCase();
  const circulation = createCommercialCirculationService(admin);

  const preference = await circulation.ensureSubscribedPreference({
    accountId: form.accountId,
    email,
    lawfulBasis: 'website_requirement_form',
    consentSource: 'website_embed',
    consentCopyVersion: form.consentCopyVersion,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: existing } = await db
    .from('commercial_requirements')
    .select('id')
    .eq('account_id', form.accountId)
    .ilike('contact_email', email)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (submission.locationText?.trim()) {
    try {
      const geo = await geocodeListingAddress({
        addressLine1: submission.locationText,
        town: null,
        county: null,
        postcode: null,
      });
      latitude = geo?.latitude ?? null;
      longitude = geo?.longitude ?? null;
    } catch {
      // geocode optional
    }
  }

  const payload = {
    contact_name: submission.contactName.trim(),
    contact_email: email,
    contact_phone: submission.contactPhone?.trim() || null,
    company_name: submission.companyName?.trim() || null,
    sector: submission.sector?.trim() || null,
    tenure: submission.tenure ?? null,
    location_text: submission.locationText?.trim() || null,
    latitude,
    longitude,
    size_min_sqft: submission.sizeMinSqft ?? null,
    size_max_sqft: submission.sizeMaxSqft ?? null,
    budget_min_pence: submission.budgetMinPence ?? null,
    budget_max_pence: submission.budgetMaxPence ?? null,
    notes: submission.notes?.trim() || null,
    source: 'website_embed',
    marketing_preference_id: (preference.id as string) ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await db
      .from('commercial_requirements')
      .update(payload)
      .eq('id', existing.id)
      .eq('account_id', form.accountId);

    if (error) throw new Error(error.message);
    return { requirementId: existing.id as string, created: false };
  }

  const { data: created, error } = await db
    .from('commercial_requirements')
    .insert({
      account_id: form.accountId,
      stage: 'new',
      ...payload,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { requirementId: created.id as string, created: true };
}
