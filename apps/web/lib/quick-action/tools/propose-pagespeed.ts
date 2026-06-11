import 'server-only';

import { z } from 'zod';

import { assertAccountMember, assertRanklyModuleEnabled } from '../module-access';
import { signQuickActionToken } from '../action-token';
import type { QuickActionContext } from '../context';
import { workspaceById } from '../context';
import type { ProposedQuickAction } from '../types';

const proposePagespeedSchema = z.object({
  account_id: z.string().uuid(),
  project_id: z.string().uuid(),
});

export async function proposePagespeedScan(
  ctx: QuickActionContext,
  input: z.infer<typeof proposePagespeedSchema>,
): Promise<ProposedQuickAction> {
  const parsed = proposePagespeedSchema.parse(input);
  await assertAccountMember(ctx.client, ctx.userId, parsed.account_id);
  await assertRanklyModuleEnabled(ctx.client, parsed.account_id);

  const workspace = workspaceById(ctx, parsed.account_id);
  if (!workspace) {
    throw new Error('Workspace not found or not accessible');
  }

  const { supabaseCustomSchema } = await import('~/lib/supabase-custom-schema');
  const { data: project, error } = await supabaseCustomSchema(ctx.client, 'rankly')
    .from('projects')
    .select('id, name, domain, account_id')
    .eq('id', parsed.project_id)
    .eq('account_id', parsed.account_id)
    .maybeSingle();

  if (error || !project) {
    throw new Error('Rankly project not found in this workspace');
  }

  const row = project as { id: string; name: string; domain: string };
  const actionToken = signQuickActionToken({
    userId: ctx.userId,
    data: {
      type: 'pagespeed_scan',
      accountId: parsed.account_id,
      projectId: row.id,
    },
  });

  return {
    actionToken,
    preview: {
      type: 'pagespeed_scan',
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      accountId: parsed.account_id,
      projectId: row.id,
      projectName: row.name,
      domain: row.domain,
    },
  };
}

export const proposePagespeedToolDefinition = {
  name: 'propose_pagespeed_scan',
  description:
    'Propose running a PageSpeed scan for a Rankly project. Call list_rankly_projects first to resolve project_id. Returns a preview for user confirmation.',
  input_schema: {
    type: 'object',
    properties: {
      account_id: { type: 'string', description: 'Workspace account UUID' },
      project_id: { type: 'string', description: 'Rankly project UUID' },
    },
    required: ['account_id', 'project_id'],
  },
};

export async function handleProposePagespeedTool(
  ctx: QuickActionContext,
  input: unknown,
): Promise<ProposedQuickAction> {
  return proposePagespeedScan(ctx, input as z.infer<typeof proposePagespeedSchema>);
}
