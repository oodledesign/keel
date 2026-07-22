import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';
import { generatePublicShareToken } from '~/lib/videos/public-share.server';

import { buildSeoReportSnapshot } from './build-snapshot';
import type { SeoReportSnapshot, SeoReportSnapshotRow } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

function ranklyClient() {
  return supabaseCustomSchema(getSupabaseServerClient(), 'rankly');
}

function mapRow(row: Record<string, unknown>): SeoReportSnapshotRow {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    account_id: String(row.account_id),
    created_by: (row.created_by as string | null) ?? null,
    title: String(row.title ?? 'SEO Report'),
    target_domain: String(row.target_domain),
    public_share_enabled: Boolean(row.public_share_enabled),
    public_share_token: (row.public_share_token as string | null) ?? null,
    snapshot: row.snapshot as SeoReportSnapshot,
    ai_audit_report_id: (row.ai_audit_report_id as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function createSeoReportSnapshot(params: {
  projectId: string;
  accountId: string;
  userId: string;
  enableShare?: boolean;
}): Promise<SeoReportSnapshotRow> {
  const built = await buildSeoReportSnapshot({
    projectId: params.projectId,
    accountId: params.accountId,
  });

  const enableShare = params.enableShare ?? true;
  const token = enableShare ? generatePublicShareToken() : null;

  const { data, error } = await ranklyAdmin()
    .from('seo_report_snapshots')
    .insert({
      project_id: params.projectId,
      account_id: params.accountId,
      created_by: params.userId,
      title: built.title,
      target_domain: built.targetDomain,
      public_share_enabled: enableShare,
      public_share_token: token,
      snapshot: built.snapshot,
      ai_audit_report_id: built.aiAuditReportId,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create SEO report');
  }

  return mapRow(data as Record<string, unknown>);
}

export async function loadSeoReportSnapshot(
  reportId: string,
): Promise<SeoReportSnapshotRow | null> {
  const { data, error } = await ranklyClient()
    .from('seo_report_snapshots')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function loadSeoReportByPublicToken(
  token: string,
): Promise<SeoReportSnapshotRow | null> {
  const { data, error } = await ranklyAdmin()
    .from('seo_report_snapshots')
    .select('*')
    .eq('public_share_token', token)
    .eq('public_share_enabled', true)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function loadLatestSeoReportForProject(
  projectId: string,
): Promise<SeoReportSnapshotRow | null> {
  const { data, error } = await ranklyClient()
    .from('seo_report_snapshots')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function updateSeoReportShare(params: {
  reportId: string;
  enabled: boolean;
  rotateToken?: boolean;
}): Promise<SeoReportSnapshotRow> {
  const existing = await loadSeoReportSnapshot(params.reportId);
  if (!existing) {
    throw new Error('Report not found');
  }

  let nextToken = existing.public_share_token;
  if (params.enabled) {
    if (!nextToken || params.rotateToken) {
      nextToken = generatePublicShareToken();
    }
  }

  const { data, error } = await ranklyAdmin()
    .from('seo_report_snapshots')
    .update({
      public_share_enabled: params.enabled,
      public_share_token: nextToken,
    })
    .eq('id', params.reportId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update share settings');
  }

  return mapRow(data as Record<string, unknown>);
}
