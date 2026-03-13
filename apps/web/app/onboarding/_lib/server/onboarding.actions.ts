'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const ACCESSIBILITY_TEXT_SIZE_COOKIE = 'accessibility_text_size';
const ACCESSIBILITY_DYSLEXIA_FONT_COOKIE = 'accessibility_dyslexia_font';
const ACCESSIBILITY_ENHANCED_FOCUS_COOKIE = 'accessibility_enhanced_focus';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type AccessibilityPreferences = {
  textSize: 'small' | 'standard' | 'large';
  dyslexiaFont: boolean;
  enhancedFocus: boolean;
};

/**
 * Fetch accessibility preferences from DB and set cookies so client and server stay in sync.
 * Call from client on mount (e.g. TextSizeSync) so first load applies saved preferences.
 */
export async function getAccessibilityPreferencesForSync(): Promise<AccessibilityPreferences | null> {
  const client = getSupabaseServerClient();
  const result = await requireUser(client);
  if (result.error || !result.data) return null;

  const { data: row } = await client
    .from('user_settings')
    .select('accessibility_text_size, accessibility_dyslexia_font, accessibility_enhanced_focus')
    .eq('user_id', result.data.id)
    .maybeSingle();

  const textSize =
    row?.accessibility_text_size === 'small' ||
    row?.accessibility_text_size === 'large'
      ? row.accessibility_text_size
      : 'standard';
  const dyslexiaFont = row?.accessibility_dyslexia_font === true;
  const enhancedFocus = row?.accessibility_enhanced_focus !== false;

  const store = await cookies();
  store.set(ACCESSIBILITY_TEXT_SIZE_COOKIE, textSize, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  store.set(ACCESSIBILITY_DYSLEXIA_FONT_COOKIE, dyslexiaFont ? '1' : '0', {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  store.set(ACCESSIBILITY_ENHANCED_FOCUS_COOKIE, enhancedFocus ? '1' : '0', {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return { textSize, dyslexiaFont, enhancedFocus };
}

export async function updateOnboardingStep(
  accountId: string,
  step: number,
): Promise<{ error?: string }> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await client
    .from('accounts_memberships')
    .update({ onboarding_step: step })
    .eq('user_id', user.id)
    .eq('account_id', accountId);

  if (error) return { error: error.message };
  revalidatePath(pathsConfig.app.onboarding);
  return {};
}

export async function completeOnboarding(
  accountId: string,
): Promise<{ error?: string }> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await client
    .from('accounts_memberships')
    .update({
      onboarding_completed: true,
      onboarding_step: 6,
    })
    .eq('user_id', user.id)
    .eq('account_id', accountId);

  if (error) return { error: error.message };
  revalidatePath(pathsConfig.app.onboarding);
  revalidatePath(pathsConfig.app.home);
  return {};
}

export async function upsertUserSettings(settings: {
  first_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
  accessibility_text_size?: 'small' | 'standard' | 'large';
  accessibility_high_contrast?: boolean;
  accessibility_simplified_mode?: boolean;
  accessibility_enhanced_focus?: boolean;
  accessibility_dyslexia_font?: boolean;
}): Promise<{ error?: string }> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await client.from('user_settings').upsert(
    {
      user_id: user.id,
      ...settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) return { error: error.message };

  // Sync personal account display name to first + last name so it shows everywhere (dropdown, selector, etc.)
  if (settings.first_name !== undefined || settings.last_name !== undefined) {
    const first = (settings.first_name ?? '').trim();
    const last = (settings.last_name ?? '').trim();
    const displayName = [first, last].filter(Boolean).join(' ').trim() || first || null;
    if (displayName) {
      await client
        .from('accounts')
        .update({ name: displayName, updated_at: new Date().toISOString() })
        .eq('primary_owner_user_id', user.id)
        .eq('is_personal_account', true);
    }
  }

  const store =
    settings.accessibility_text_size !== undefined ||
    settings.accessibility_dyslexia_font !== undefined ||
    settings.accessibility_enhanced_focus !== undefined
      ? await cookies()
      : null;
  if (store) {
    if (settings.accessibility_text_size !== undefined) {
      store.set(ACCESSIBILITY_TEXT_SIZE_COOKIE, settings.accessibility_text_size, {
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    if (settings.accessibility_dyslexia_font !== undefined) {
      store.set(ACCESSIBILITY_DYSLEXIA_FONT_COOKIE, settings.accessibility_dyslexia_font ? '1' : '0', {
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    if (settings.accessibility_enhanced_focus !== undefined) {
      store.set(ACCESSIBILITY_ENHANCED_FOCUS_COOKIE, settings.accessibility_enhanced_focus ? '1' : '0', {
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
  }

  revalidatePath(pathsConfig.app.onboarding);
  return {};
}

export async function updateMembershipTradeRole(
  accountId: string,
  tradeRole: string,
): Promise<{ error?: string }> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { error } = await client
    .from('accounts_memberships')
    .update({ trade_role: tradeRole })
    .eq('user_id', user.id)
    .eq('account_id', accountId);

  if (error) return { error: error.message };
  revalidatePath(pathsConfig.app.onboarding);
  return {};
}

/**
 * Create a test subscription for the account (dev/testing only).
 * Uses service_role to call upsert_subscription so the account gets status 'active' without going through Stripe.
 */
export async function createTestSubscription(
  accountId: string,
): Promise<{ error?: string }> {
  const allowTest =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ALLOW_TEST_SUBSCRIPTION === 'true';
  if (!allowTest) {
    return { error: 'Test subscriptions are only available in development.' };
  }

  try {
    await requireUserInServerComponent();
    const admin = getSupabaseServerAdminClient();

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subId = `sub_test_${accountId.replace(/-/g, '').slice(0, 12)}`;
    const customerId = `cus_test_${accountId.replace(/-/g, '').slice(0, 12)}`;

    const { error } = await admin.rpc('upsert_subscription', {
      target_account_id: accountId,
      target_customer_id: customerId,
      target_subscription_id: subId,
      active: true,
      status: 'active',
      billing_provider: 'stripe',
      cancel_at_period_end: false,
      currency: 'usd',
      period_starts_at: now.toISOString(),
      period_ends_at: periodEnd.toISOString(),
      line_items: [],
    });

    if (error) return { error: error.message };
    revalidatePath(pathsConfig.app.onboarding);
    revalidatePath(pathsConfig.app.home);
    return {};
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Failed to create test subscription.';
    return { error: message };
  }
}

/**
 * Delete the current team from onboarding (owner only, no OTP).
 * Use when the user cancels setting up a new team. Redirects to /home after delete.
 */
export async function deleteTeamAccountFromOnboarding(
  accountId: string,
): Promise<{ error?: string }> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data: isOwner, error: rpcError } = await client
    .rpc('is_account_owner', { account_id: accountId })
    .single();

  if (rpcError || !isOwner) {
    return { error: 'You do not have permission to delete this team.' };
  }

  const { error } = await client.from('accounts').delete().eq('id', accountId);

  if (error) return { error: error.message };
  revalidatePath(pathsConfig.app.onboarding);
  revalidatePath(pathsConfig.app.home);
  redirect(pathsConfig.app.home);
}

export async function createTeamAndContinueOnboarding(
  accountName: string,
  accountSlug: string | null,
): Promise<{ error?: string; accountId?: string }> {
  try {
    const user = await requireUserInServerComponent();
    const client = getSupabaseServerClient();

    // One business only: if user already has a team account, send them to continue that onboarding
    const { data: existing } = await client
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (existing?.account_id) {
      return {
        error: 'already_has_business',
        accountId: existing.account_id,
      };
    }

    const admin = getSupabaseServerAdminClient();

    const { data: account, error } = await admin.rpc('create_team_account', {
      account_name: accountName,
      user_id: user.id,
      account_slug: accountSlug ?? undefined,
    });

    if (error) {
      if (error.code === '23505') return { error: 'duplicate_slug' };
      return { error: error.message };
    }

    // RPC returns single row (accounts); Supabase may return object or array
    const row = Array.isArray(account) ? account[0] : account;
    const accountId =
      row && typeof row === 'object' && 'id' in row
        ? (row as { id: string }).id
        : null;
    if (!accountId) {
      return { error: 'Failed to create business. Please try again.' };
    }
    revalidatePath(pathsConfig.app.onboarding);
    revalidatePath(pathsConfig.app.home);
    return { accountId };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Failed to create business. Please try again.';
    return { error: message };
  }
}
