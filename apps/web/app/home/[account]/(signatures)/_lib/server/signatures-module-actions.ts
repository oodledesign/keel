'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { isSignaturesModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import {
  getSignaturesSupabaseClient,
  pushAllSignatures,
  pushSignatureToStaff,
  syncStaffFromM365,
} from '~/lib/signatures/graph';

import {
  deleteDepartmentBadgeActionSchema,
  disconnectM365ActionSchema,
  pushAllActionSchema,
  pushStaffActionSchema,
  saveTemplateActionSchema,
  syncStaffActionSchema,
  upsertDepartmentBadgeActionSchema,
  updateStaffActionSchema,
} from '../schema/signatures-module.schema';
import { uploadPhotoFromDataUrl } from './signatures-data';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

function staffDetailPath(accountSlug: string, staffId: string) {
  return pathsConfig.app.accountSignaturesStaffDetail
    .replace('[account]', accountSlug)
    .replace('[staffId]', staffId);
}

function templateDetailPath(accountSlug: string, templateId: string) {
  return pathsConfig.app.accountSignaturesTemplateDetail
    .replace('[account]', accountSlug)
    .replace('[templateId]', templateId);
}

async function assertSignaturesAdmin(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Account admin required');
  }

  const { data: rows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId);

  const moduleSettings = Object.fromEntries(
    (rows ?? []).map((row) => [row.module_key, row.enabled]),
  ) as Record<string, boolean>;

  if (!isSignaturesModuleEnabled(moduleSettings)) {
    throw new Error('Signatures is disabled for this account');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    throw new Error('Account not found');
  }

  return { accountSlug: account.slug as string };
}

export const syncSignaturesStaff = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const result = await syncStaffFromM365(input.accountId);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    return result;
  },
  { schema: syncStaffActionSchema },
);

export const pushAllSignaturesAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const result = await pushAllSignatures(input.accountId, user.id);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    return result;
  },
  { schema: pushAllActionSchema },
);

export const pushStaffSignatureAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const { data: staff } = await db
      .from('staff')
      .select('id')
      .eq('id', input.staffId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const result = await pushSignatureToStaff(input.staffId);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    revalidatePath(staffDetailPath(accountSlug, input.staffId));
    return result;
  },
  { schema: pushStaffActionSchema },
);

export const updateSignatureStaff = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();

    let photoUrl: string | null | undefined;
    if (input.photoDataUrl) {
      photoUrl = await uploadPhotoFromDataUrl(
        input.accountId,
        input.staffId,
        input.photoDataUrl,
      );
    }

    const update = {
      full_name: input.full_name,
      job_title: input.job_title,
      department: input.department,
      phone_direct: input.phone_direct,
      phone_mobile: input.phone_mobile,
      branch: input.branch,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    };

    const { data: staff, error } = await db
      .from('staff')
      .update(update)
      .eq('id', input.staffId)
      .eq('account_id', input.accountId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!staff) {
      throw new Error('Staff member not found');
    }

    await db.from('staff_templates').delete().eq('staff_id', input.staffId);

    if (input.templateId) {
      const { data: template } = await db
        .from('templates')
        .select('id')
        .eq('id', input.templateId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (!template) {
        throw new Error('Template not found');
      }

      const { error: linkError } = await db.from('staff_templates').insert({
        staff_id: input.staffId,
        template_id: input.templateId,
      });

      if (linkError) {
        throw new Error(linkError.message);
      }
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    revalidatePath(staffDetailPath(accountSlug, input.staffId));
    return { ok: true as const };
  },
  { schema: updateStaffActionSchema },
);

export const saveSignatureTemplate = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();

    if (input.is_default) {
      await db
        .from('templates')
        .update({ is_default: false })
        .eq('account_id', input.accountId);
    }

    const { error } = await db
      .from('templates')
      .update({
        name: input.name,
        html_template: input.html_template,
        is_default: input.is_default,
      })
      .eq('id', input.templateId)
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesTemplates, accountSlug));
    revalidatePath(templateDetailPath(accountSlug, input.templateId));
    return { ok: true as const };
  },
  { schema: saveTemplateActionSchema },
);

export const disconnectMicrosoft365 = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const { error } = await db
      .from('ms_connections')
      .delete()
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    return { ok: true as const };
  },
  { schema: disconnectM365ActionSchema },
);

export const upsertDepartmentBadgeAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const department = input.department.trim();

    const { error } = await db.from('department_badges').upsert(
      {
        account_id: input.accountId,
        department,
        award_badge_url: input.award_badge_url.trim(),
      },
      {
        onConflict: 'account_id,department',
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    return { ok: true as const };
  },
  { schema: upsertDepartmentBadgeActionSchema },
);

export const deleteDepartmentBadgeAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const { error } = await db
      .from('department_badges')
      .delete()
      .eq('account_id', input.accountId)
      .eq('department', input.department.trim());

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    return { ok: true as const };
  },
  { schema: deleteDepartmentBadgeActionSchema },
);
