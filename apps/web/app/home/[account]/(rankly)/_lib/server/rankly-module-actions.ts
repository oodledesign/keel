'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { isWorkModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

import {
  addRanklyKeywordActionSchema,
  addRanklyKeywordsBulkActionSchema,
  addPagespeedPageActionSchema,
  createRanklyProjectActionSchema,
  deletePagespeedPageActionSchema,
  deleteRanklyKeywordActionSchema,
  deleteRanklyProjectActionSchema,
} from '../schema/rankly-module.schema';
import { computeNextRankCheckAt } from '~/lib/rank-tracking/types';
import {
  countPagespeedPages,
  ensureHomepagePage,
  insertPagespeedPage,
  deletePagespeedPage,
} from '~/lib/pagespeed/db';
import {
  normalizePagespeedUrl,
  pageLabelFromUrl,
} from '~/lib/pagespeed/domain';
import { MAX_PAGESPEED_PAGES_PER_PROJECT } from '~/lib/pagespeed/types';

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

function ranklyProjectSectionPath(
  template: string,
  accountSlug: string,
  projectId: string,
) {
  return template
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

function revalidateRanklyProjectPaths(accountSlug: string, projectId: string) {
  revalidatePath(ranklyProjectDetailPath(accountSlug, projectId));
  revalidatePath(
    ranklyProjectSectionPath(
      pathsConfig.app.accountRanklyProjectKeywords,
      accountSlug,
      projectId,
    ),
  );
  revalidatePath(
    ranklyProjectSectionPath(
      pathsConfig.app.accountRanklyProjectSiteExplorer,
      accountSlug,
      projectId,
    ),
  );
  revalidatePath(
    ranklyProjectSectionPath(
      pathsConfig.app.accountRanklyProjectPagespeed,
      accountSlug,
      projectId,
    ),
  );
}

async function assertRanklyWrite(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const isMember = await userIsAccountMember(client, userId, accountId);

  if (!isMember) {
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

    const { data: created, error } = await supabaseCustomSchema(client, 'rankly')
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
      })
      .select('id')
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? 'Failed to create project');
    }

    const nextRankCheck = computeNextRankCheckAt('weekly');
    await supabaseCustomSchema(client, 'rankly')
      .from('project_cron_state')
      .upsert({
        project_id: created.id,
        next_rank_check_at: nextRankCheck?.toISOString() ?? null,
        next_pagespeed_check_at: nextRankCheck?.toISOString() ?? null,
      });

    await ensureHomepagePage({
      projectId: created.id as string,
      domain: input.domain,
    });

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
    revalidateRanklyProjectPaths(accountSlug, input.projectId);
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

    revalidateRanklyProjectPaths(accountSlug, input.projectId);
    revalidatePath(workPath(pathsConfig.app.accountRanklyProjects, accountSlug));
    return { ok: true as const };
  },
  { schema: addRanklyKeywordActionSchema },
);

export const addRanklyKeywordsBulk = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const rankly = supabaseCustomSchema(client, 'rankly');

    const { data: project, error: pe } = await rankly
      .from('projects')
      .select('id')
      .eq('id', input.projectId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (pe || !project) {
      throw new Error('Project not found');
    }

    const uniqueIncoming = [
      ...new Map(
        input.keywords.map((keyword) => {
          const trimmed = keyword.trim().replace(/\s+/g, ' ');
          return [trimmed.toLowerCase(), trimmed] as const;
        }),
      ).values(),
    ].filter(Boolean);

    if (uniqueIncoming.length === 0) {
      throw new Error('No valid keywords to add');
    }

    const { data: existingRows, error: existingError } = await rankly
      .from('keywords')
      .select('keyword')
      .eq('project_id', input.projectId);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existing = new Set(
      (existingRows ?? []).map((row) =>
        String(row.keyword).trim().toLowerCase(),
      ),
    );

    const toInsert = uniqueIncoming.filter(
      (keyword) => !existing.has(keyword.toLowerCase()),
    );

    if (toInsert.length === 0) {
      return {
        ok: true as const,
        added: 0,
        skipped: uniqueIncoming.length,
      };
    }

    const { error } = await rankly.from('keywords').insert(
      toInsert.map((keyword) => ({
        project_id: input.projectId,
        keyword,
        search_engine: input.search_engine,
        device: input.device,
      })),
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidateRanklyProjectPaths(accountSlug, input.projectId);
    revalidatePath(workPath(pathsConfig.app.accountRanklyProjects, accountSlug));

    return {
      ok: true as const,
      added: toInsert.length,
      skipped: uniqueIncoming.length - toInsert.length,
    };
  },
  { schema: addRanklyKeywordsBulkActionSchema },
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

    revalidateRanklyProjectPaths(accountSlug, row.project_id as string);
    return { ok: true as const };
  },
  { schema: deleteRanklyKeywordActionSchema },
);

export const addPagespeedPage = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const rankly = supabaseCustomSchema(client, 'rankly');
    const { data: project, error: pe } = await rankly
      .from('projects')
      .select('id, domain')
      .eq('id', input.projectId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (pe || !project?.domain) {
      throw new Error('Project not found');
    }

    const pageCount = await countPagespeedPages(input.projectId);
    if (pageCount >= MAX_PAGESPEED_PAGES_PER_PROJECT) {
      throw new Error(
        `You can track up to ${MAX_PAGESPEED_PAGES_PER_PROJECT} pages per project`,
      );
    }

    const url = normalizePagespeedUrl(input.url, String(project.domain));
    const label =
      input.label?.trim() ||
      pageLabelFromUrl(url, false);

    await insertPagespeedPage({
      projectId: input.projectId,
      url,
      label,
    });

    revalidateRanklyProjectPaths(accountSlug, input.projectId);
    return { ok: true as const };
  },
  { schema: addPagespeedPageActionSchema },
);

export const deletePagespeedPageAction = enhanceAction(
  async (input, user) => {
    const { client, accountSlug } = await assertRanklyWrite(
      input.accountId,
      user.id,
    );

    const { data: page, error: pe } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('pagespeed_pages')
      .select('id, project_id')
      .eq('id', input.pageId)
      .maybeSingle();

    if (pe || !page) {
      throw new Error('Page not found');
    }

    const { data: project } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('account_id')
      .eq('id', page.project_id as string)
      .maybeSingle();

    if (!project || project.account_id !== input.accountId) {
      throw new Error('Page not found');
    }

    await deletePagespeedPage(input.pageId);

    revalidateRanklyProjectPaths(accountSlug, page.project_id as string);
    return { ok: true as const };
  },
  { schema: deletePagespeedPageActionSchema },
);
