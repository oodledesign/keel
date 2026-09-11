import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { fireNewSubscriberAutomations } from '~/lib/campaigns/campaign-automations.service';
import { isUsableMailingListUnsubscribeToken } from '~/lib/campaigns/campaign-test-send';
import { resolveStoredClientDisplayName } from '~/lib/clients/resolve-client-list-display';
import { normalizeCirculationEmail } from '~/lib/commercial/circulation/circulation-eligibility';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import {
  type RequirementFormSubmission,
  upsertRequirementFromPublicForm,
} from '~/lib/commercial/circulation/public-requirement-form';

import type { FormContactValues } from './form-fields';
import type { MailingListSpec } from './mailing-list-fields';

const PURPOSE = 'workspace_mailing_list' as const;
const CONSENT_COPY_VERSION = 'v1';

export const WORKSPACE_MAILING_LIST_PURPOSE = PURPOSE;

/** Allowed by `workspace_mailing_preferences_lawful_basis_check`. */
export const WORKSPACE_MAILING_LAWFUL_BASES = [
  'website_form',
  'imported_historical',
  'manual_opt_in',
  'other',
] as const;

export type WorkspaceMailingLawfulBasis =
  (typeof WORKSPACE_MAILING_LAWFUL_BASES)[number];

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function newUnsubscribeToken() {
  return randomBytes(24).toString('hex');
}

export type WorkspaceMailingPreference = {
  id: string;
  accountId: string;
  clientId: string | null;
  email: string;
  marketingStatus: 'subscribed' | 'unsubscribed' | 'suppressed';
  unsubscribeToken: string;
};

export type WorkspaceMailingSubscriber = {
  preferenceId: string;
  clientId: string | null;
  email: string;
  displayName: string | null;
  consentedAt: string | null;
};

function mapPreference(
  row: Record<string, unknown>,
): WorkspaceMailingPreference {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    clientId: (row.client_id as string | null) ?? null,
    email: String(row.email),
    marketingStatus:
      row.marketing_status as WorkspaceMailingPreference['marketingStatus'],
    unsubscribeToken: String(row.unsubscribe_token),
  };
}

function splitPersonName(name: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Contact', lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Create or update the workspace contact (`clients`) for a public form.
 * People stay on the existing CRM table — this is not a second directory.
 */
export async function upsertWorkspaceContactFromForm(
  admin: SupabaseClient,
  accountId: string,
  contact: FormContactValues,
): Promise<string> {
  const email = normalizeCirculationEmail(contact.contactEmail);
  const db = fromTable(admin, 'clients');

  const { data: existing } = await db
    .select(
      'id, display_name, company_name, first_name, last_name, phone, client_type',
    )
    .eq('account_id', accountId)
    .ilike('email', email)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { firstName, lastName } = splitPersonName(contact.contactName || email);
  const companyName = contact.companyName?.trim() || null;
  const clientType = companyName ? 'business' : 'individual';
  const displayName = resolveStoredClientDisplayName({
    clientType,
    companyName,
    firstName,
    lastName,
  });

  if (existing?.id) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (contact.contactPhone && !existing.phone) {
      patch.phone = contact.contactPhone;
    }
    if (companyName && !existing.company_name) {
      patch.company_name = companyName;
    }
    if (contact.contactName.trim() && !existing.display_name) {
      patch.display_name = displayName;
    }

    if (Object.keys(patch).length > 1) {
      const { error } = await db
        .update(patch)
        .eq('id', existing.id)
        .eq('account_id', accountId);
      if (error) throw new Error(error.message);
    }

    return String(existing.id);
  }

  const { data, error } = await db
    .insert({
      account_id: accountId,
      client_type: clientType,
      first_name: clientType === 'individual' ? firstName : null,
      last_name: clientType === 'individual' ? lastName : null,
      display_name: displayName,
      company_name: clientType === 'individual' ? null : companyName,
      email,
      phone: contact.contactPhone,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not save contact');
  }

  return String((data as { id: string }).id);
}

export async function ensureWorkspaceMailingPreference(input: {
  admin: SupabaseClient;
  accountId: string;
  email: string;
  clientId?: string | null;
  consentSource?: string;
}): Promise<WorkspaceMailingPreference> {
  const email = normalizeCirculationEmail(input.email);
  const db = fromTable(input.admin, 'workspace_mailing_preferences');

  const { data: existing } = await db
    .select('*')
    .eq('account_id', input.accountId)
    .eq('email', email)
    .eq('purpose', PURPOSE)
    .maybeSingle();

  if (existing) {
    if (
      existing.marketing_status === 'unsubscribed' ||
      existing.marketing_status === 'suppressed'
    ) {
      return mapPreference(existing as Record<string, unknown>);
    }

    const { data, error } = await db
      .update({
        client_id: input.clientId ?? existing.client_id,
        consent_source: input.consentSource ?? existing.consent_source,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(
        error?.message ?? 'Could not update mailing list preference',
      );
    }

    return mapPreference(data as Record<string, unknown>);
  }

  const { data, error } = await db
    .insert({
      account_id: input.accountId,
      client_id: input.clientId ?? null,
      email,
      purpose: PURPOSE,
      marketing_status: 'subscribed',
      lawful_basis: 'website_form' satisfies WorkspaceMailingLawfulBasis,
      consent_source: input.consentSource ?? 'workspace_form',
      consent_copy_version: CONSENT_COPY_VERSION,
      unsubscribe_token: newUnsubscribeToken(),
      consented_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not subscribe to mailing list');
  }

  const preference = mapPreference(data as Record<string, unknown>);
  void fireNewSubscriberAutomations({
    client: input.admin,
    accountId: input.accountId,
    email: preference.email,
    unsubscribeToken: preference.unsubscribeToken,
  }).catch(() => undefined);

  return preference;
}

export type PublicMailingPreferenceResult = {
  email: string;
  accountId: string;
  marketingStatus: WorkspaceMailingPreference['marketingStatus'];
};

export async function lookupWorkspaceMailingListByToken(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  if (!isUsableMailingListUnsubscribeToken(token)) return null;

  const db = fromTable(admin, 'workspace_mailing_preferences');
  const { data } = await db
    .select('account_id, email, marketing_status')
    .eq('unsubscribe_token', token)
    .eq('purpose', PURPOSE)
    .maybeSingle();

  if (!data) return null;

  return {
    email: String(data.email),
    accountId: String(data.account_id),
    marketingStatus:
      data.marketing_status as WorkspaceMailingPreference['marketingStatus'],
  };
}

export async function unsubscribeWorkspaceMailingListByToken(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  if (!isUsableMailingListUnsubscribeToken(token)) return null;

  const db = fromTable(admin, 'workspace_mailing_preferences');
  const { data } = await db
    .select('id, account_id, email, marketing_status')
    .eq('unsubscribe_token', token)
    .eq('purpose', PURPOSE)
    .maybeSingle();

  if (!data) return null;

  const current =
    data.marketing_status as WorkspaceMailingPreference['marketingStatus'];

  // Public token links must not clear a suppression (bounce / complaint).
  if (current === 'suppressed') {
    return {
      email: String(data.email),
      accountId: String(data.account_id),
      marketingStatus: 'suppressed',
    };
  }

  if (current !== 'unsubscribed') {
    const { error } = await db
      .update({
        marketing_status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    if (error) throw new Error(error.message);
  }

  return {
    email: String(data.email),
    accountId: String(data.account_id),
    marketingStatus: 'unsubscribed',
  };
}

export async function resubscribeWorkspaceMailingListByToken(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  if (!isUsableMailingListUnsubscribeToken(token)) return null;

  const db = fromTable(admin, 'workspace_mailing_preferences');
  const { data } = await db
    .select('id, account_id, email, marketing_status')
    .eq('unsubscribe_token', token)
    .eq('purpose', PURPOSE)
    .maybeSingle();

  if (!data) return null;

  const current =
    data.marketing_status as WorkspaceMailingPreference['marketingStatus'];

  if (current === 'suppressed') {
    return {
      email: String(data.email),
      accountId: String(data.account_id),
      marketingStatus: 'suppressed',
    };
  }

  if (current !== 'subscribed') {
    const { error } = await db
      .update({
        marketing_status: 'subscribed',
        unsubscribed_at: null,
        consented_at: new Date().toISOString(),
        consent_source: 'unsubscribe_page_resubscribe',
      })
      .eq('id', data.id);

    if (error) throw new Error(error.message);
  }

  return {
    email: String(data.email),
    accountId: String(data.account_id),
    marketingStatus: 'subscribed',
  };
}

export function buildWorkspaceMailingListUnsubscribeUrl(token: string): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
      : '');
  const base = configured || 'http://localhost:3000';
  return `${base}/unsubscribe/mailing-list?token=${encodeURIComponent(token)}`;
}

/**
 * Subscribed contacts a later campaign sender can target.
 * Does not include unsubscribed or suppressed addresses.
 */
export async function listWorkspaceMailingListSubscribers(
  admin: SupabaseClient,
  accountId: string,
): Promise<WorkspaceMailingSubscriber[]> {
  const { data, error } = await fromTable(
    admin,
    'workspace_mailing_preferences',
  )
    .select(
      'id, client_id, email, consented_at, clients(display_name, company_name)',
    )
    .eq('account_id', accountId)
    .eq('purpose', PURPOSE)
    .eq('marketing_status', 'subscribed')
    .order('consented_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const linked = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const client = linked as {
      display_name?: string | null;
      company_name?: string | null;
    } | null;
    return {
      preferenceId: String(row.id),
      clientId: (row.client_id as string | null) ?? null,
      email: String(row.email),
      displayName:
        client?.display_name?.trim() || client?.company_name?.trim() || null,
      consentedAt: (row.consented_at as string | null) ?? null,
    };
  });
}

export async function submitMailingListSignup(input: {
  admin: SupabaseClient;
  accountId: string;
  contact: FormContactValues;
  spec: MailingListSpec;
  commercial: boolean;
}): Promise<{
  clientId: string;
  requirementId: string | null;
  preferenceId: string;
  subscribed: boolean;
}> {
  const email = normalizeCirculationEmail(input.contact.contactEmail);
  const clientId = await upsertWorkspaceContactFromForm(
    input.admin,
    input.accountId,
    input.contact,
  );

  const preference = await ensureWorkspaceMailingPreference({
    admin: input.admin,
    accountId: input.accountId,
    email,
    clientId,
    consentSource: 'workspace_form',
  });

  let requirementId: string | null = null;

  if (input.commercial) {
    const circulation = createCommercialCirculationService(input.admin);
    await circulation.ensureSubscribedPreference({
      accountId: input.accountId,
      email,
      lawfulBasis: 'website_requirement_form',
      consentSource: 'workspace_form',
      clientId,
    });

    const submission: RequirementFormSubmission = {
      contactName: input.contact.contactName,
      contactEmail: email,
      contactPhone: input.contact.contactPhone,
      companyName: input.spec.companyName,
      sector: input.spec.sector,
      tenure: input.spec.tenure,
      locationText: input.spec.locationText,
      searchRadiusMiles: input.spec.searchRadiusMiles,
      sizeMinSqft: input.spec.sizeMinSqft,
      sizeMaxSqft: input.spec.sizeMaxSqft,
      budgetMinPence: input.spec.budgetMinPence,
      budgetMaxPence: input.spec.budgetMaxPence,
      notes: input.spec.notes,
    };

    const result = await upsertRequirementFromPublicForm(
      input.admin,
      {
        accountId: input.accountId,
        offices: [],
        consentCopyVersion: CONSENT_COPY_VERSION,
        consentSource: 'workspace_form',
      },
      submission,
    );
    requirementId = result.requirementId;

    const requirementPatch: Record<string, unknown> = {
      client_id: clientId,
    };
    if (input.spec.useClass) {
      requirementPatch.use_class = input.spec.useClass;
    }

    const { error: patchError } = await fromTable(
      input.admin,
      'commercial_requirements',
    )
      .update(requirementPatch)
      .eq('id', requirementId)
      .eq('account_id', input.accountId);

    if (patchError) throw new Error(patchError.message);
  }

  return {
    clientId,
    requirementId,
    preferenceId: preference.id,
    subscribed: preference.marketingStatus === 'subscribed',
  };
}
