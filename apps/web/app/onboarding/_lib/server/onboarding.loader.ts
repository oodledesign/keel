import 'server-only';

import { cache } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type CompanyRole =
  | 'admin'
  | 'staff_member'
  | 'contractor'
  | 'client';

export interface OnboardingContext {
  accountId: string;
  accountSlug: string;
  accountName: string;
  prefillName: string | null;
  companyRole: CompanyRole | null;
  tradeRole: string | null;
  onboardingStep: number;
  onboardingCompleted: boolean;
  hasActiveSubscription: boolean;
  userSettings: {
    first_name: string | null;
    last_name: string | null;
    mobile: string | null;
    accessibility_text_size: string;
    accessibility_high_contrast: boolean;
    accessibility_simplified_mode: boolean;
    accessibility_enhanced_focus: boolean;
    accessibility_dyslexia_font: boolean;
  } | null;
}

export const getOnboardingContext = cache(
  async (accountId: string | null): Promise<OnboardingContext | null> => {
    if (!accountId) return null;

    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { data: membership, error: memError } = await client
      .from('accounts_memberships')
      .select(
        'account_id, onboarding_step, onboarding_completed, company_role, trade_role',
      )
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();

    if (memError || !membership) return null;

    const { data: account } = await client
      .from('accounts')
      .select('id, slug, name')
      .eq('id', accountId)
      .single();

    if (!account) return null;

    const { data: sub } = await client
      .from('subscriptions')
      .select('status')
      .eq('account_id', accountId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    const { data: userSettings } = await client
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Prefill name for onboarding from personal account (e.g. after invite sign-up)
    let prefillName: string | null = null;
    const { data: personalAccount } = await client
      .from('accounts')
      .select('name')
      .eq('primary_owner_user_id', user.id)
      .eq('is_personal_account', true)
      .maybeSingle();
    if (personalAccount?.name) prefillName = personalAccount.name;

    return {
      accountId: account.id,
      accountSlug: account.slug ?? '',
      accountName: account.name,
      prefillName,
      companyRole: (membership.company_role as CompanyRole) ?? null,
      tradeRole: membership.trade_role ?? null,
      onboardingStep: membership.onboarding_step ?? 1,
      onboardingCompleted: membership.onboarding_completed ?? false,
      hasActiveSubscription:
        sub?.status === 'active' || sub?.status === 'trialing',
      userSettings: userSettings
        ? {
            first_name: userSettings.first_name ?? null,
            last_name: userSettings.last_name ?? null,
            mobile: userSettings.mobile ?? null,
            accessibility_text_size:
              userSettings.accessibility_text_size ?? 'standard',
            accessibility_high_contrast:
              userSettings.accessibility_high_contrast ?? false,
            accessibility_simplified_mode:
              userSettings.accessibility_simplified_mode ?? true,
            accessibility_enhanced_focus:
              userSettings.accessibility_enhanced_focus ?? true,
            accessibility_dyslexia_font:
              userSettings.accessibility_dyslexia_font ?? false,
          }
        : null,
    };
  },
);

export async function requireOnboardingContext(
  accountId: string | null,
): Promise<OnboardingContext> {
  const ctx = await getOnboardingContext(accountId ?? null);
  if (!ctx) redirect(pathsConfig.app.home);
  return ctx;
}

/**
 * If the user has any team account with incomplete onboarding, return its account_id and step
 * so we can redirect them to continue (instead of showing Create Business again).
 */
export async function getFirstIncompleteOnboarding(): Promise<{
  accountId: string;
  step: number;
} | null> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data: row } = await client
    .from('accounts_memberships')
    .select('account_id, onboarding_step, company_role')
    .eq('user_id', user.id)
    .eq('onboarding_completed', false)
    .limit(1)
    .maybeSingle();

  if (!row?.account_id) return null;
  // For admins/staff/contractors, never return step 1 when they already have a business
  // (would show Create business again). Clients don't have the "Create business" step,
  // so we can safely resume from whatever step they were on.
  const isClient = row.company_role === 'client';
  const step = isClient
    ? row.onboarding_step ?? 1
    : Math.max(2, row.onboarding_step ?? 2);
  return { accountId: row.account_id, step };
}

/**
 * Returns the first team account where the user has completed onboarding (for "Back to dashboard").
 * Excludes excludeAccountId so we don't link back to the team currently being set up.
 */
export async function getFirstCompletedOnboardingAccount(excludeAccountId?: string): Promise<{
  accountSlug: string;
  accountName: string;
} | null> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  let query = client
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', user.id)
    .eq('onboarding_completed', true)
    .limit(1);

  if (excludeAccountId) {
    query = query.neq('account_id', excludeAccountId);
  }

  const { data: membership } = await query.maybeSingle();
  if (!membership?.account_id) return null;

  const { data: account } = await client
    .from('accounts')
    .select('slug, name')
    .eq('id', membership.account_id)
    .not('slug', 'is', null)
    .single();

  if (!account?.slug) return null;
  return { accountSlug: account.slug, accountName: account.name };
}

/**
 * Returns whether the current user is the primary owner of the given account (for "Cancel this team").
 */
export async function isCurrentUserAccountOwner(accountId: string): Promise<boolean> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .rpc('is_account_owner', { account_id: accountId })
    .single();

  return !error && data === true;
}
