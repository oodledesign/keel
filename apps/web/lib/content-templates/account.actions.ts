'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  mapAccountTemplate,
  mapSystemTemplate,
} from '~/lib/content-templates/map-rows';
import {
  getTemplateById,
  listTemplatesForPicker,
  resolveDefaultTemplate,
} from '~/lib/content-templates/resolve-template';
import {
  DeleteAccountTemplateSchema,
  DuplicateSystemToAccountSchema,
  GetResolvedTemplateSchema,
  ListTemplatesPickerSchema,
  SetAccountTemplateDefaultSchema,
  UpsertAccountTemplateSchema,
} from '~/lib/content-templates/schemas';
import {
  type AccountTemplateKind,
  MAX_ACCOUNT_TEMPLATES_PER_KIND,
} from '~/lib/content-templates/types';

function revalidateAccountTemplates(accountSlug?: string) {
  if (accountSlug) {
    revalidatePath(`/home/${accountSlug}/settings/templates`);
    revalidatePath(`/app/${accountSlug}/settings/templates`);
    revalidatePath(`/home/${accountSlug}/proposals`);
    revalidatePath(`/app/${accountSlug}/proposals`);
  }
}

export const listAccountTemplatesAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: rows, error } = await client
      .from('account_content_templates')
      .select('*')
      .eq('account_id', data.accountId)
      .eq('kind', data.kind)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) =>
      mapAccountTemplate(row as Record<string, unknown>),
    );
  },
  {
    auth: true,
    schema: z.object({
      accountId: z.string().uuid(),
      kind: z.enum(['proposal_html', 'proposal_email', 'contract_email']),
    }),
  },
);

export const listSystemTemplatesForKindAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: rows, error } = await client
      .from('content_templates')
      .select('*')
      .eq('kind', data.kind)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) =>
      mapSystemTemplate(row as Record<string, unknown>),
    );
  },
  {
    auth: true,
    schema: z.object({
      kind: z.enum([
        'proposal_html',
        'proposal_email',
        'contract_email',
        'email_reply',
      ]),
    }),
  },
);

export const listTemplatesPickerAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    return listTemplatesForPicker(client, {
      kind: data.kind,
      accountId: data.accountId,
      userId: user.id,
    });
  },
  { auth: true, schema: ListTemplatesPickerSchema },
);

export const getResolvedTemplateAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    return getTemplateById(client, data);
  },
  { auth: true, schema: GetResolvedTemplateSchema },
);

export const resolveDefaultTemplateAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    return resolveDefaultTemplate(client, {
      kind: data.kind,
      accountId: data.accountId,
      userId: user.id,
    });
  },
  {
    auth: true,
    schema: z.object({
      kind: z.enum([
        'proposal_html',
        'proposal_email',
        'contract_email',
        'email_reply',
      ]),
      accountId: z.string().uuid().optional().nullable(),
    }),
  },
);

export const upsertAccountTemplateAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    if (!data.id) {
      const { count } = await client
        .from('account_content_templates')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', data.accountId)
        .eq('kind', data.kind);

      if ((count ?? 0) >= MAX_ACCOUNT_TEMPLATES_PER_KIND) {
        throw new Error(
          `Maximum of ${MAX_ACCOUNT_TEMPLATES_PER_KIND} templates per type`,
        );
      }
    }

    if (data.isDefault) {
      await client
        .from('account_content_templates')
        .update({ is_default: false })
        .eq('account_id', data.accountId)
        .eq('kind', data.kind);
    }

    const payload = {
      account_id: data.accountId,
      kind: data.kind as AccountTemplateKind,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      subject: data.subject?.trim() || null,
      body_html: data.bodyHtml ?? '',
      body_text: data.bodyText ?? '',
      signature: data.signature?.trim() || null,
      is_default: data.isDefault ?? false,
      source_system_template_id: data.sourceSystemTemplateId ?? null,
      created_by: user.id,
    };

    if (data.id) {
      const { error } = await client
        .from('account_content_templates')
        .update(payload)
        .eq('id', data.id)
        .eq('account_id', data.accountId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client
        .from('account_content_templates')
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    revalidateAccountTemplates(data.accountSlug);
    return { ok: true as const };
  },
  { auth: true, schema: UpsertAccountTemplateSchema },
);

export const deleteAccountTemplateAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('account_content_templates')
      .delete()
      .eq('id', data.id)
      .eq('account_id', data.accountId);
    if (error) throw new Error(error.message);
    revalidateAccountTemplates(data.accountSlug);
    return { ok: true as const };
  },
  { auth: true, schema: DeleteAccountTemplateSchema },
);

export const setAccountTemplateDefaultAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: row, error: loadError } = await client
      .from('account_content_templates')
      .select('kind')
      .eq('id', data.id)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (loadError || !row) {
      throw new Error(loadError?.message ?? 'Template not found');
    }

    const kind = (row as { kind: string }).kind;
    await client
      .from('account_content_templates')
      .update({ is_default: false })
      .eq('account_id', data.accountId)
      .eq('kind', kind);

    const { error } = await client
      .from('account_content_templates')
      .update({ is_default: true })
      .eq('id', data.id)
      .eq('account_id', data.accountId);

    if (error) throw new Error(error.message);
    revalidateAccountTemplates(data.accountSlug);
    return { ok: true as const };
  },
  { auth: true, schema: SetAccountTemplateDefaultSchema },
);

export const duplicateSystemToAccountAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: system, error: loadError } = await client
      .from('content_templates')
      .select('*')
      .eq('id', data.systemTemplateId)
      .eq('is_active', true)
      .maybeSingle();

    if (loadError || !system) {
      throw new Error(loadError?.message ?? 'System template not found');
    }

    const mapped = mapSystemTemplate(system as Record<string, unknown>);
    if (
      mapped.kind !== 'proposal_html' &&
      mapped.kind !== 'proposal_email' &&
      mapped.kind !== 'contract_email'
    ) {
      throw new Error('This template cannot be duplicated to a workspace');
    }

    const { count } = await client
      .from('account_content_templates')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', data.accountId)
      .eq('kind', mapped.kind);

    if ((count ?? 0) >= MAX_ACCOUNT_TEMPLATES_PER_KIND) {
      throw new Error(
        `Maximum of ${MAX_ACCOUNT_TEMPLATES_PER_KIND} templates per type`,
      );
    }

    const { error } = await client.from('account_content_templates').insert({
      account_id: data.accountId,
      kind: mapped.kind,
      name: data.name?.trim() || `${mapped.name} (copy)`,
      description: mapped.description,
      subject: mapped.subject,
      body_html: mapped.bodyHtml,
      body_text: mapped.bodyText,
      signature: mapped.signature,
      is_default: false,
      source_system_template_id: mapped.id,
      created_by: user.id,
    });

    if (error) throw new Error(error.message);
    revalidateAccountTemplates(data.accountSlug);
    return { ok: true as const };
  },
  { auth: true, schema: DuplicateSystemToAccountSchema },
);
