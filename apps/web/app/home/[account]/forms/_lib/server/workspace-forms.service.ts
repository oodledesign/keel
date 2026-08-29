import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import {
  type WorkspaceFormDestination,
  type WorkspaceFormField,
  type WorkspaceFormStatus,
  defaultWorkspaceFormFields,
  ensureListingField,
} from '~/lib/workspace-forms/form-fields';
import type {
  CreateWorkspaceFormInput,
  PublishWorkspaceFormInput,
  UpdateWorkspaceFormInput,
} from '~/lib/workspace-forms/form.schema';
import { parseFormFields } from '~/lib/workspace-forms/public-form';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function generateShareToken() {
  return randomBytes(24).toString('hex');
}

export type WorkspaceFormRecord = {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  status: WorkspaceFormStatus;
  destination: WorkspaceFormDestination;
  listingId: string | null;
  shareToken: string;
  embedKey: string;
  enabled: boolean;
  submitLabel: string;
  successMessage: string | null;
  fields: WorkspaceFormField[];
  createdAt: string;
  updatedAt: string;
  submissionCount: number;
};

export type WorkspaceFormSubmissionRecord = {
  id: string;
  formId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  listingId: string | null;
  pipelineDealId: string | null;
  commercialEnquiryId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ListingOption = {
  id: string;
  name: string;
};

type FormRow = {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  status: WorkspaceFormStatus;
  destination: WorkspaceFormDestination;
  listing_id: string | null;
  share_token: string;
  embed_key: string;
  enabled: boolean;
  submit_label: string | null;
  success_message: string | null;
  fields: unknown;
  created_at: string;
  updated_at: string;
};

function mapForm(row: FormRow, submissionCount = 0): WorkspaceFormRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    description: row.description,
    status: row.status,
    destination: row.destination,
    listingId: row.listing_id,
    shareToken: row.share_token,
    embedKey: row.embed_key,
    enabled: row.enabled,
    submitLabel: row.submit_label?.trim() || 'Submit',
    successMessage: row.success_message,
    fields: parseFormFields(row.fields),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submissionCount,
  };
}

export function createWorkspaceFormsService(client: SupabaseClient) {
  return {
    async listForms(accountId: string): Promise<WorkspaceFormRecord[]> {
      const { data, error } = await fromTable(client, 'workspace_forms')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(error.message);

      const forms = ((data ?? []) as FormRow[]).map((row) => mapForm(row));
      if (forms.length === 0) return [];

      const { data: counts, error: countError } = await fromTable(
        client,
        'workspace_form_submissions',
      )
        .select('form_id')
        .eq('account_id', accountId)
        .in(
          'form_id',
          forms.map((form) => form.id),
        );

      if (countError) {
        return forms;
      }

      const tally = new Map<string, number>();
      for (const row of (counts ?? []) as Array<{ form_id: string }>) {
        tally.set(row.form_id, (tally.get(row.form_id) ?? 0) + 1);
      }

      return forms.map((form) => ({
        ...form,
        submissionCount: tally.get(form.id) ?? 0,
      }));
    },

    async getForm(
      accountId: string,
      formId: string,
    ): Promise<WorkspaceFormRecord | null> {
      const { data, error } = await fromTable(client, 'workspace_forms')
        .select('*')
        .eq('account_id', accountId)
        .eq('id', formId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      const { count } = await fromTable(client, 'workspace_form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('form_id', formId);

      return mapForm(data as FormRow, count ?? 0);
    },

    async listSubmissions(
      accountId: string,
      formId: string,
    ): Promise<WorkspaceFormSubmissionRecord[]> {
      const { data, error } = await fromTable(
        client,
        'workspace_form_submissions',
      )
        .select(
          'id, form_id, contact_name, contact_email, contact_phone, listing_id, pipeline_deal_id, commercial_enquiry_id, payload, created_at',
        )
        .eq('account_id', accountId)
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        formId: String(row.form_id),
        contactName: (row.contact_name as string | null) ?? null,
        contactEmail: (row.contact_email as string | null) ?? null,
        contactPhone: (row.contact_phone as string | null) ?? null,
        listingId: (row.listing_id as string | null) ?? null,
        pipelineDealId: (row.pipeline_deal_id as string | null) ?? null,
        commercialEnquiryId:
          (row.commercial_enquiry_id as string | null) ?? null,
        payload:
          row.payload && typeof row.payload === 'object'
            ? (row.payload as Record<string, unknown>)
            : {},
        createdAt: String(row.created_at),
      }));
    },

    async listListingOptions(accountId: string): Promise<ListingOption[]> {
      const { data, error } = await fromTable(client, 'commercial_listings')
        .select('id, name')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
        .limit(80);

      if (error) return [];

      return ((data ?? []) as Array<{ id: string; name: string | null }>).map(
        (row) => ({
          id: row.id,
          name: row.name?.trim() || 'Untitled listing',
        }),
      );
    },

    async createForm(
      input: CreateWorkspaceFormInput,
    ): Promise<WorkspaceFormRecord> {
      const fields =
        input.destination === 'listing_enquiry'
          ? ensureListingField(defaultWorkspaceFormFields())
          : defaultWorkspaceFormFields();

      const { data, error } = await fromTable(client, 'workspace_forms')
        .insert({
          account_id: input.accountId,
          name: input.name.trim(),
          destination: input.destination,
          share_token: generateShareToken(),
          embed_key: generateShareToken(),
          status: 'draft',
          enabled: false,
          fields,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Could not create form');
      }

      return mapForm(data as FormRow);
    },

    async updateForm(
      input: UpdateWorkspaceFormInput,
    ): Promise<WorkspaceFormRecord> {
      const fields =
        input.destination === 'listing_enquiry'
          ? ensureListingField(input.fields)
          : input.fields;

      const updates: Record<string, unknown> = {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        destination: input.destination,
        listing_id: input.listingId || null,
        submit_label: input.submitLabel?.trim() || 'Submit',
        success_message: input.successMessage?.trim() || null,
        fields,
        updated_at: new Date().toISOString(),
      };

      if (input.status) updates.status = input.status;
      if (typeof input.enabled === 'boolean') {
        updates.enabled = input.enabled;
        if (input.enabled) updates.status = 'published';
        if (!input.enabled && input.status !== 'archived') {
          updates.status = 'draft';
        }
      }

      const { data, error } = await fromTable(client, 'workspace_forms')
        .update(updates)
        .eq('id', input.formId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Could not update form');
      }

      return mapForm(data as FormRow);
    },

    async setPublished(
      input: PublishWorkspaceFormInput,
    ): Promise<WorkspaceFormRecord> {
      const { data, error } = await fromTable(client, 'workspace_forms')
        .update({
          enabled: input.enabled,
          status: input.enabled ? 'published' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.formId)
        .eq('account_id', input.accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Could not update form');
      }

      return mapForm(data as FormRow);
    },

    async deleteForm(accountId: string, formId: string): Promise<void> {
      const { error } = await fromTable(client, 'workspace_forms')
        .delete()
        .eq('id', formId)
        .eq('account_id', accountId);

      if (error) throw new Error(error.message);
    },
  };
}
