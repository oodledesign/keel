import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';

/** Stable prefix used for once-per-day dedupe lookups. */
export const AI_CREDITS_EXHAUSTED_BODY_PREFIX = "You're out of AI credits";

async function resolveBillingLink(
  accountId: string,
): Promise<string | undefined> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select('slug, is_personal_account')
    .eq('id', accountId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  if (data.is_personal_account) {
    return toHomeBillingHref(pathsConfig.app.personalAccountBilling);
  }

  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  if (!slug) {
    return undefined;
  }

  return toHomeBillingHref(pathsConfig.app.accountBilling, slug);
}

/**
 * Create at most one undismissed in-app notification per account per 24h
 * when AI credits run out. Never throws.
 */
export async function notifyAiCreditsExhausted(params: {
  accountId: string;
  creditsRemaining: number;
  creditsRequired: number;
}): Promise<void> {
  try {
    const admin = getSupabaseServerAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recent, error: recentError } = await admin
      .from('notifications')
      .select('id')
      .eq('account_id', params.accountId)
      .eq('channel', 'in_app')
      .eq('dismissed', false)
      .gte('created_at', since)
      .ilike('body', `${AI_CREDITS_EXHAUSTED_BODY_PREFIX}%`)
      .limit(1);

    if (recentError) {
      console.warn('[ai-credits-notify] dedupe query failed', {
        accountId: params.accountId,
        error: recentError.message,
      });
    } else if ((recent ?? []).length > 0) {
      return;
    }

    const link = await resolveBillingLink(params.accountId);
    const body = `${AI_CREDITS_EXHAUSTED_BODY_PREFIX} (need ${params.creditsRequired}, have ${params.creditsRemaining}). Top up to keep using AI features.`;

    await createInAppNotification({
      accountId: params.accountId,
      type: 'warning',
      body,
      link,
    });
  } catch (error) {
    console.warn('[ai-credits-notify] failed', {
      accountId: params.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
