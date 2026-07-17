import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';

export const MAX_ACTIVITY_BLOCKS_PER_UPLOAD = 250;

export type ActivityBlockInput = {
  app_name: string;
  bundle_id: string;
  domain?: string | null;
  url?: string | null;
  window_title: string;
  repo_name?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
};

export type ActivityPrivacySettings = {
  tracking_enabled: boolean;
  capture_full_urls: boolean;
};

export type ActivityBlockUploadResult = {
  inserted: number;
  matched: number;
  account_id: string;
};

function parseTimestamp(value: string, field: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${field}`);
  }
  return new Date(parsed).toISOString();
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeActivityBlockInput(
  block: ActivityBlockInput,
  privacy: ActivityPrivacySettings,
) {
  const appName = block.app_name.trim();
  if (!appName) {
    throw new Error('Each block requires app_name');
  }

  const startedAt = parseTimestamp(block.started_at, 'started_at');
  const endedAt = parseTimestamp(block.ended_at, 'ended_at');

  if (Date.parse(endedAt) < Date.parse(startedAt)) {
    throw new Error('ended_at must be on or after started_at');
  }

  if (!Number.isInteger(block.duration_seconds) || block.duration_seconds < 0) {
    throw new Error('duration_seconds must be a non-negative integer');
  }

  return {
    app_name: appName,
    bundle_id: block.bundle_id.trim(),
    domain: normalizeOptionalText(block.domain),
    url: privacy.capture_full_urls ? normalizeOptionalText(block.url) : null,
    window_title: block.window_title.trim(),
    repo_name: normalizeOptionalText(block.repo_name),
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: block.duration_seconds,
  };
}

async function loadActivityPrivacySettings(
  accountId: string,
  userId: string,
): Promise<ActivityPrivacySettings> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('activity_privacy_settings')
    .select('tracking_enabled, capture_full_urls')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    tracking_enabled: (data?.tracking_enabled as boolean | undefined) ?? false,
    capture_full_urls:
      (data?.capture_full_urls as boolean | undefined) ?? false,
  };
}

export async function uploadActivityBlocks(params: {
  userId: string;
  accountId: string;
  blocks: ActivityBlockInput[];
}): Promise<ActivityBlockUploadResult> {
  if (params.blocks.length === 0) {
    throw new Error('At least one activity block is required');
  }

  if (params.blocks.length > MAX_ACTIVITY_BLOCKS_PER_UPLOAD) {
    throw new Error(
      `Too many blocks in one upload (max ${MAX_ACTIVITY_BLOCKS_PER_UPLOAD})`,
    );
  }

  const admin = getSupabaseServerAdminClient();

  await assertWorkspaceMember(admin, params.accountId, params.userId);

  const privacy = await loadActivityPrivacySettings(
    params.accountId,
    params.userId,
  );

  if (!privacy.tracking_enabled) {
    throw new Error(
      'Activity tracking is disabled for this workspace. Enable it under Workspace settings → Activity tracking.',
    );
  }

  const rows = params.blocks.map((block) => ({
    account_id: params.accountId,
    user_id: params.userId,
    ...normalizeActivityBlockInput(block, privacy),
  }));

  const { data, error } = await admin
    .from('activity_blocks')
    .insert(rows)
    .select('id, is_confirmed, project_id, client_id');

  if (error) {
    throw new Error(error.message);
  }

  const insertedRows = data ?? [];
  const matched = insertedRows.filter(
    (row) =>
      row.is_confirmed === true ||
      row.project_id != null ||
      row.client_id != null,
  ).length;

  return {
    inserted: insertedRows.length,
    matched,
    account_id: params.accountId,
  };
}
