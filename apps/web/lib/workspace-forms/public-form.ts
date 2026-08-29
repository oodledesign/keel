import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { AccountBrandResolved } from '~/lib/brand/account-brand';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { FormSubmitError } from '~/lib/workspace-forms/form-submit-error';

import {
  type FormContactValues,
  type WorkspaceFormDestination,
  type WorkspaceFormField,
  extractContactFromValues,
  formatPipelineNotes,
  resolveBoundListingId,
} from './form-fields';
import type { PublicWorkspaceFormSubmitInput } from './form.schema';
import {
  extractMailingListSpec,
  isMailingListOptedIn,
} from './mailing-list-fields';
import { submitMailingListSignup } from './workspace-mailing-list';

/** Tables not yet in generated Database types. */
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export type PublicWorkspaceForm = {
  id: string;
  accountId: string;
  accountName: string;
  accountSlug: string | null;
  name: string;
  description: string | null;
  destination: WorkspaceFormDestination;
  listingId: string | null;
  shareToken: string;
  embedKey: string;
  submitLabel: string;
  successMessage: string;
  fields: WorkspaceFormField[];
  brand: AccountBrandResolved;
  commercialProperty: boolean;
};

type FormRow = {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  destination: WorkspaceFormDestination;
  listing_id: string | null;
  share_token: string;
  embed_key: string;
  enabled: boolean;
  status: string;
  submit_label: string | null;
  success_message: string | null;
  fields: unknown;
};

export function parseFormFields(raw: unknown): WorkspaceFormField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is WorkspaceFormField => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Partial<WorkspaceFormField>;
    return Boolean(row.id && row.type && row.key && row.label);
  });
}

export async function loadPublicWorkspaceFormByToken(
  admin: SupabaseClient,
  token: string,
): Promise<PublicWorkspaceForm | null> {
  if (!token || token.length < 16) return null;

  const selectColumns =
    'id, account_id, name, description, destination, listing_id, share_token, embed_key, enabled, status, submit_label, success_message, fields';

  const byShare = await fromTable(admin, 'workspace_forms')
    .select(selectColumns)
    .eq('share_token', token)
    .eq('enabled', true)
    .eq('status', 'published')
    .maybeSingle();

  let data = byShare.data as FormRow | null;
  if (!data) {
    const byEmbed = await fromTable(admin, 'workspace_forms')
      .select(selectColumns)
      .eq('embed_key', token)
      .eq('enabled', true)
      .eq('status', 'published')
      .maybeSingle();
    data = (byEmbed.data as FormRow | null) ?? null;
  }

  if (!data) return null;

  const row = data;
  const [{ data: account }, brand] = await Promise.all([
    admin
      .from('accounts')
      .select('name, slug, space_type')
      .eq('id', row.account_id)
      .maybeSingle(),
    loadAccountBrandResolved(row.account_id),
  ]);

  return {
    id: row.id,
    accountId: row.account_id,
    accountName:
      (account as { name?: string | null } | null)?.name?.trim() || 'Workspace',
    accountSlug:
      (account as { slug?: string | null } | null)?.slug?.trim() || null,
    commercialProperty:
      (account as { space_type?: string | null } | null)?.space_type ===
      'commercial-property',
    name: row.name,
    description: row.description,
    destination: row.destination,
    listingId: row.listing_id,
    shareToken: row.share_token,
    embedKey: row.embed_key,
    submitLabel: row.submit_label?.trim() || 'Submit',
    successMessage:
      row.success_message?.trim() ||
      (row.destination === 'mailing_list'
        ? 'Thank you — you are on the mailing list.'
        : 'Thank you — we have received your enquiry.'),
    fields: parseFormFields(row.fields),
    brand,
  };
}

export const loadCachedPublicWorkspaceForm = cache(async (token: string) => {
  const admin = getSupabaseServerAdminClient();
  return loadPublicWorkspaceFormByToken(admin, token);
});

async function resolveListingForAccount(
  admin: SupabaseClient,
  accountId: string,
  listingId: string | null,
  propertyId: string | null,
): Promise<{ id: string; name: string | null } | null> {
  if (listingId) {
    const { data } = await fromTable(admin, 'commercial_listings')
      .select('id, name')
      .eq('id', listingId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (data) {
      return data as { id: string; name: string | null };
    }
  }

  if (propertyId) {
    const { data } = await fromTable(admin, 'commercial_listings')
      .select('id, name')
      .eq('account_id', accountId)
      .eq('commercial_property_id', propertyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      return data as { id: string; name: string | null };
    }
  }

  return null;
}

async function createPipelineLead(
  admin: SupabaseClient,
  form: PublicWorkspaceForm,
  contact: FormContactValues,
  listingId: string | null,
): Promise<string> {
  const dealName =
    contact.companyName || contact.contactName || `${form.accountName} enquiry`;

  const { data, error } = await fromTable(admin, 'pipeline_deals')
    .insert({
      account_id: form.accountId,
      name: dealName,
      contact_name: contact.contactName || dealName,
      company_name: contact.companyName || contact.contactName || '',
      notes: formatPipelineNotes(contact),
      value: 0,
      stage: 'lead',
      source: 'website',
      commercial_listing_id: listingId,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create pipeline enquiry');
  }

  return String((data as { id: string }).id);
}

async function createListingEnquiry(
  admin: SupabaseClient,
  form: PublicWorkspaceForm,
  contact: FormContactValues,
  listingId: string,
): Promise<string> {
  const { data, error } = await fromTable(admin, 'commercial_enquiries')
    .insert({
      account_id: form.accountId,
      listing_id: listingId,
      contact_name: contact.contactName || null,
      contact_email: contact.contactEmail || null,
      contact_phone: contact.contactPhone,
      message: contact.message,
      source: 'website',
      status: 'unactioned',
      received_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create listing enquiry');
  }

  return String((data as { id: string }).id);
}

export type PublicFormSubmitResult = {
  submissionId: string;
  pipelineDealId: string | null;
  commercialEnquiryId: string | null;
  requirementId: string | null;
  clientId: string | null;
  listingId: string | null;
  successMessage: string;
};

export async function submitPublicWorkspaceForm(
  admin: SupabaseClient,
  form: PublicWorkspaceForm,
  input: PublicWorkspaceFormSubmitInput,
): Promise<PublicFormSubmitResult> {
  const contact = extractContactFromValues(form.fields, input.values);
  const boundListingId = resolveBoundListingId({
    queryListingId: input.listingId,
    hiddenListingId: contact.listingId,
    formListingId: form.listingId,
  });

  const listing = await resolveListingForAccount(
    admin,
    form.accountId,
    boundListingId,
    input.propertyId ?? null,
  );

  if (form.destination === 'listing_enquiry' && !listing) {
    throw new FormSubmitError(
      'This form needs a listing. Add ?listing= to the URL or choose a default listing in the form settings.',
    );
  }

  if (!contact.contactName && !contact.contactEmail) {
    throw new FormSubmitError('Please enter your name or email.');
  }

  if (form.destination === 'mailing_list' && !contact.contactEmail) {
    throw new FormSubmitError(
      'Please enter your email to join the mailing list.',
    );
  }

  if (form.destination === 'mailing_list' && !isMailingListOptedIn(contact)) {
    throw new FormSubmitError(
      'Please confirm you want to receive emails from this workspace.',
    );
  }

  let pipelineDealId: string | null = null;
  let commercialEnquiryId: string | null = null;
  let requirementId: string | null = null;
  let clientId: string | null = null;

  let successMessage = form.successMessage;

  if (form.destination === 'mailing_list') {
    const spec = extractMailingListSpec(contact);
    const mailing = await submitMailingListSignup({
      admin,
      accountId: form.accountId,
      contact,
      spec,
      commercial: form.commercialProperty,
    });
    clientId = mailing.clientId;
    requirementId = mailing.requirementId;
    if (!mailing.subscribed) {
      successMessage =
        'We have your details, but this email is unsubscribed from the mailing list. Contact the workspace if you want emails again.';
    }
  } else if (form.destination === 'listing_enquiry' && listing) {
    commercialEnquiryId = await createListingEnquiry(
      admin,
      form,
      contact,
      listing.id,
    );
  } else {
    pipelineDealId = await createPipelineLead(
      admin,
      form,
      contact,
      listing?.id ?? null,
    );
  }

  const { data, error } = await fromTable(admin, 'workspace_form_submissions')
    .insert({
      account_id: form.accountId,
      form_id: form.id,
      payload: input.values,
      contact_name: contact.contactName || null,
      contact_email: contact.contactEmail || null,
      contact_phone: contact.contactPhone,
      listing_id: listing?.id ?? null,
      pipeline_deal_id: pipelineDealId,
      commercial_enquiry_id: commercialEnquiryId,
      requirement_id: requirementId,
      client_id: clientId,
    })
    .select('id')
    .single();

  if (error || !data) {
    if (pipelineDealId) {
      await fromTable(admin, 'pipeline_deals')
        .delete()
        .eq('id', pipelineDealId)
        .eq('account_id', form.accountId);
    }
    if (commercialEnquiryId) {
      await fromTable(admin, 'commercial_enquiries')
        .delete()
        .eq('id', commercialEnquiryId)
        .eq('account_id', form.accountId);
    }
    throw new FormSubmitError('Could not store submission', 500);
  }

  return {
    submissionId: String((data as { id: string }).id),
    pipelineDealId,
    commercialEnquiryId,
    requirementId,
    clientId,
    listingId: listing?.id ?? null,
    successMessage,
  };
}
