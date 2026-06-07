'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  addRanklyKeywordActionSchema,
  createRanklyProjectActionSchema,
  deleteRanklyKeywordActionSchema,
  deleteRanklyProjectActionSchema,
} from '../schema/rankly-module.schema';

function workPath(
  template: string,
  accountSlug: string,
  suffix = '',
): string {
  return template.replace('[account]', accountSlug) + suffix;
}

function ranklyProjectDetailPath(accountSlug: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectDetail
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

async function assertRanklyWrite(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    throw new Error('You do not have access to this account');
  }

  const { data: rows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId);

  const moduleSettings = Object.fromEntries(
    (rows ?? []).map((row) => [row.module_key, row.enabled]),
  ) as Record<string, boolean>;

  if (!isWorkModuleEnabled(moduleSettings, 'rankly')) {
    throw new Error('Rankly is disabled for this account');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    throw new Error('Account not found');
  }

  return { client, accountSlug: account.slug as string };
}

export const createRanklyProject = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const { error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .insert({
        account_id: input.accountId,
        name: input.name,
        domain: input.domain,
        colour: input.colour ?? null,
        notes: input.notes ?? null,
        target_country: input.target_country,
        target_language: input.target_language,
        track_desktop: input.track_desktop,
        track_mobile: input.track_mobile,
        client_id: input.clientId ?? null,
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountRanklyProjects, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountRanklyDashboard, accountSlug));
    if (input.clientId) {
      revalidatePath(
        `/app/work/${accountSlug}/clients/${input.clientId}`,
      );
    }
    return { ok: true as const };
  },
  { schema: createRanklyProjectActionSchema },
);

export const deleteRanklyProject = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const { data: project, error: pe } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('projects')
      .select('id')
      .eq('id', input.projectId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (pe || !project) {
      throw new Error('Project not found');
    }

    const { error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .delete()
      .eq('id', input.projectId)
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountRanklyProjects, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountRanklyDashboard, accountSlug));
    revalidatePath(ranklyProjectDetailPath(accountSlug, input.projectId));
    return { ok: true as const };
  },
  { schema: deleteRanklyProjectActionSchema },
);

export const addRanklyKeyword = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const { data: project, error: pe } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('projects')
      .select('id')
      .eq('id', input.projectId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (pe || !project) {
      throw new Error('Project not found');
    }

    const { error } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .insert({
        project_id: input.projectId,
        keyword: input.keyword.trim(),
        search_engine: input.search_engine,
        device: input.device,
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(ranklyProjectDetailPath(accountSlug, input.projectId));
    revalidatePath(workPath(pathsConfig.app.accountRanklyProjects, accountSlug));
    return { ok: true as const };
  },
  { schema: addRanklyKeywordActionSchema },
);

export const deleteRanklyKeyword = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const { data: row, error: ke } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('keywords')
      .select('id, project_id')
      .eq('id', input.keywordId)
      .maybeSingle();

    if (ke || !row) {
      throw new Error('Keyword not found');
    }

    const { data: project } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('account_id')
      .eq('id', row.project_id as string)
      .maybeSingle();

    if (!project || project.account_id !== input.accountId) {
      throw new Error('Keyword not found');
    }

    const { error } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .delete()
      .eq('id', input.keywordId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(
      ranklyProjectDetailPath(accountSlug, row.project_id as string),
    );
    return { ok: true as const };
  },
  { schema: deleteRanklyKeywordActionSchema },
);
