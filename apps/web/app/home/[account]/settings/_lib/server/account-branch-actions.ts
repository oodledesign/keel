'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { loadAccountBranches } from '~/lib/brand/account-branches';

import {
  deleteAccountBranchSchema,
  saveAccountBranchSchema,
  saveAccountBranchesSchema,
} from '../schema/account-branches.schema';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

async function assertAccountOwnerOrAdmin(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Workspace owner or admin required');
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

function revalidateBrandPaths(accountSlug: string) {
  revalidatePath(workPath(pathsConfig.app.accountBrandSettings, accountSlug));
  revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
  revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
}

async function clearOtherDefaults(accountId: string, exceptId?: string | null) {
  const admin = getSupabaseServerAdminClient();
  let query = admin
    .from('account_branches')
    .update({ is_default: false })
    .eq('account_id', accountId)
    .eq('is_default', true);

  if (exceptId) {
    query = query.neq('id', exceptId);
  }

  await query;
}

export const loadAccountBranchesAction = enhanceAction(
  async (input) => loadAccountBranches(input.accountId),
  {
    schema: z.object({ accountId: z.string().uuid() }),
  },
);

export const saveAccountBranchAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertAccountOwnerOrAdmin(
      input.accountId,
      user.id,
    );

    const admin = getSupabaseServerAdminClient();
    const payload = {
      account_id: input.accountId,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      is_default: input.is_default ?? false,
    };

    if (payload.is_default) {
      await clearOtherDefaults(input.accountId, input.branchId ?? undefined);
    }

    if (input.branchId) {
      const { error } = await admin
        .from('account_branches')
        .update(payload)
        .eq('id', input.branchId)
        .eq('account_id', input.accountId);

      if (error) throw new Error(error.message);
    } else {
      const { count } = await admin
        .from('account_branches')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', input.accountId);

      const { error } = await admin.from('account_branches').insert({
        ...payload,
        is_default: payload.is_default || (count ?? 0) === 0,
        sort_order: count ?? 0,
      });

      if (error) throw new Error(error.message);
    }

    revalidateBrandPaths(accountSlug);
    return { ok: true as const };
  },
  { schema: saveAccountBranchSchema },
);

export const saveAccountBranchesAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertAccountOwnerOrAdmin(
      input.accountId,
      user.id,
    );

    const admin = getSupabaseServerAdminClient();
    const existing = await loadAccountBranches(input.accountId);
    const existingIds = new Set(existing.map((b) => b.id));
    const incomingIds = new Set(
      input.branches.map((b) => b.id).filter(Boolean) as string[],
    );

    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        await admin
          .from('account_branches')
          .delete()
          .eq('id', id)
          .eq('account_id', input.accountId);
      }
    }

    let defaultIndex = input.branches.findIndex((b) => b.is_default);
    if (defaultIndex < 0 && input.branches.length > 0) {
      defaultIndex = 0;
    }

    for (let index = 0; index < input.branches.length; index += 1) {
      const branch = input.branches[index]!;
      const payload = {
        account_id: input.accountId,
        name: branch.name.trim(),
        address: branch.address?.trim() || null,
        phone: branch.phone?.trim() || null,
        email: branch.email?.trim() || null,
        is_default: index === defaultIndex,
        sort_order: index,
      };

      if (branch.id && existingIds.has(branch.id)) {
        const { error } = await admin
          .from('account_branches')
          .update(payload)
          .eq('id', branch.id)
          .eq('account_id', input.accountId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from('account_branches').insert(payload);
        if (error) throw new Error(error.message);
      }
    }

    revalidateBrandPaths(accountSlug);
    return { ok: true as const };
  },
  { schema: saveAccountBranchesSchema },
);

export const deleteAccountBranchAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertAccountOwnerOrAdmin(
      input.accountId,
      user.id,
    );

    const admin = getSupabaseServerAdminClient();
    await admin
      .from('account_branches')
      .delete()
      .eq('id', input.branchId)
      .eq('account_id', input.accountId);

    revalidateBrandPaths(accountSlug);
    return { ok: true as const };
  },
  { schema: deleteAccountBranchSchema },
);
