import 'server-only';

import { revalidatePath } from 'next/cache';

import { Database } from '@kit/supabase/database';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  type WorkspaceProfile,
  businessTypeForProfile,
  spaceTypeForProfile,
} from '~/home/[account]/_lib/server/workspace-profile';
import { requiredEntitlementForProfile } from '~/lib/billing/ozer-plan-catalog';
import { fromAccountsUntyped } from '~/lib/supabase/accounts-table';
import {
  readTeamAccountFromRpc,
  slugifyWorkspaceName,
  uniqueWorkspaceSlug,
} from '~/lib/workspace/team-account-rpc';

export type WorkspaceSetupSelection = {
  profile: WorkspaceProfile;
  name: string;
  /** Business workspaces only: Free vs paid Starter/Pro. */
  businessMode?: 'lite' | 'full';
};

export type WorkspaceSetupResult = {
  error?: string;
  success?: boolean;
  redirectTo?: string;
  billingRequired?: boolean;
  accountId?: string;
  accountSlug?: string;
};

type AdminClient = ReturnType<typeof getSupabaseServerAdminClient<Database>>;

function businessTypeForSelection(sel: WorkspaceSetupSelection): string | null {
  if (sel.profile === 'work_property') return 'property';
  if (sel.profile === 'work_design') {
    return sel.businessMode === 'full' ? 'other' : 'lite';
  }
  return businessTypeForProfile(sel.profile);
}

function requiresBillingAfterSetup(
  sel: WorkspaceSetupSelection,
  billingIntent?: { productId: string; planId: string },
): boolean {
  const required = requiredEntitlementForProfile(sel.profile);
  if (!required) {
    return false;
  }

  if (sel.profile === 'work_design') {
    if (sel.businessMode === 'full') {
      return true;
    }

    const productId = billingIntent?.productId ?? '';
    if (
      productId.startsWith('ozer-business-') &&
      productId !== 'ozer-business-lite'
    ) {
      return true;
    }

    return false;
  }

  return true;
}

async function uniqueSlug(admin: AdminClient, base: string): Promise<string> {
  return uniqueWorkspaceSlug(async (table, slug) => {
    if (table === 'accounts') {
      const { data } = await admin
        .from('accounts')
        .select('id')
        .eq('slug', slug)
        .limit(1);
      return Boolean(data?.length);
    }

    const { data } = await admin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .limit(1);
    return Boolean(data?.length);
  }, base);
}

export async function completeWorkspaceSetupForUser(
  userId: string,
  selections: WorkspaceSetupSelection[],
  options?: {
    billingIntent?: {
      productId: string;
      planId: string;
      interval?: 'month' | 'year';
      seats?: number;
    };
    /** Continue with personal account only — no team workspaces. */
    skipTeamWorkspaces?: boolean;
  },
): Promise<WorkspaceSetupResult> {
  const skipTeamWorkspaces = Boolean(options?.skipTeamWorkspaces);

  if (!skipTeamWorkspaces && !selections.length) {
    return { error: 'Select at least one workspace type.' };
  }

  const admin = getSupabaseServerAdminClient();
  const client = getSupabaseServerClient();

  if (skipTeamWorkspaces) {
    const { error: settingsError } = await client.from('user_settings').upsert(
      {
        user_id: userId,
        workspace_setup_skipped_at: new Date().toISOString(),
        use_ozer_for_work: false,
        use_ozer_for_family: false,
        use_ozer_for_community: false,
      },
      { onConflict: 'user_id' },
    );

    if (settingsError) {
      console.error('[workspace-setup] skip settings:', settingsError.message);
      return { error: settingsError.message };
    }

    const { error: memErr } = await admin
      .from('accounts_memberships')
      .update({ onboarding_completed: true })
      .eq('user_id', userId);

    if (memErr) {
      console.error('[workspace-setup] onboarding_completed:', memErr.message);
      return { error: memErr.message };
    }

    const { data: guest } = await admin
      .from('project_guests')
      .select('project_id')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const guestProjectId = (guest as { project_id?: string } | null)
      ?.project_id;

    revalidatePath(pathsConfig.app.workspaceSetup);
    revalidatePath(pathsConfig.app.home);

    return {
      success: true,
      redirectTo: guestProjectId
        ? pathsConfig.app.personalGuestProject.replace(
            '[projectId]',
            guestProjectId,
          )
        : pathsConfig.app.home,
      billingRequired: false,
    };
  }

  const useWork = selections.some(
    (s) =>
      s.profile === 'work_design' ||
      s.profile === 'work_property' ||
      s.profile === 'building_surveyor',
  );
  const useFamily = selections.some((s) => s.profile === 'family');
  const useCommunity = selections.some((s) => s.profile === 'community');

  let firstTeamSlug: string | null = null;
  let firstPaidSlug: string | null = null;
  let firstBusinessSlug: string | null = null;
  let firstBusinessAccountId: string | null = null;

  for (const sel of selections) {
    const name = sel.name.trim();
    if (!name) {
      return { error: 'Every workspace needs a name.' };
    }

    const baseSlug = slugifyWorkspaceName(name);
    const slug = await uniqueSlug(admin, baseSlug);
    const spaceType = spaceTypeForProfile(sel.profile);
    const businessType = businessTypeForSelection(sel);

    const { data: account, error } = await admin.rpc('create_team_account', {
      account_name: name,
      user_id: userId,
      account_slug: slug,
      account_space_type: spaceType,
      account_business_type: businessType ?? undefined,
      account_complete_onboarding: true,
    });

    if (error) {
      console.error('[workspace-setup] create_team_account:', error.message);
      return { error: error.message };
    }

    const created = readTeamAccountFromRpc(account);
    const createdSlug = created?.slug?.trim() || slug;
    const createdId = created?.id ?? null;

    if (!firstTeamSlug && createdSlug) {
      firstTeamSlug = createdSlug;
    }
    if (
      !firstPaidSlug &&
      createdSlug &&
      sel.profile !== 'work_design' &&
      requiresBillingAfterSetup(sel, options?.billingIntent)
    ) {
      firstPaidSlug = createdSlug;
    }

    if (!firstBusinessSlug && createdSlug && sel.profile === 'work_design') {
      firstBusinessSlug = createdSlug;
      firstBusinessAccountId = createdId;

      if (createdId) {
        const { error: stepError } = await fromAccountsUntyped(admin)
          .update({
            business_onboarding_step: 'client',
            business_onboarding_completed_at: null,
          })
          .eq('id', createdId);

        if (stepError) {
          console.error(
            '[workspace-setup] business_onboarding_step:',
            stepError.message,
          );
        }
      } else {
        console.error(
          '[workspace-setup] create_team_account returned no id; using slug lookup',
        );
        const { data: bySlug } = await fromAccountsUntyped(admin)
          .select('id')
          .eq('slug', createdSlug)
          .eq('primary_owner_user_id', userId)
          .maybeSingle();
        const lookedUpId = (bySlug as { id?: string } | null)?.id ?? null;
        firstBusinessAccountId = lookedUpId;
        if (lookedUpId) {
          await fromAccountsUntyped(admin)
            .update({
              business_onboarding_step: 'client',
              business_onboarding_completed_at: null,
            })
            .eq('id', lookedUpId);
        }
      }
    }
  }

  await client.from('user_settings').upsert({
    user_id: userId,
    use_ozer_for_work: useWork,
    use_ozer_for_family: useFamily,
    use_ozer_for_community: useCommunity,
    workspace_setup_skipped_at: null,
  });

  // Mark every membership complete (cleans up duplicate workspaces from earlier retries).
  const { error: memErr } = await admin
    .from('accounts_memberships')
    .update({ onboarding_completed: true })
    .eq('user_id', userId);

  if (memErr) {
    console.error('[workspace-setup] onboarding_completed:', memErr.message);
    return { error: memErr.message };
  }

  revalidatePath(pathsConfig.app.workspaceSetup);
  revalidatePath(pathsConfig.app.home);
  if (firstTeamSlug) {
    revalidatePath(
      pathsConfig.app.accountHome.replace('[account]', firstTeamSlug),
    );
  }

  const redirectTo = firstBusinessSlug
    ? `${pathsConfig.app.businessOnboarding}?account=${encodeURIComponent(firstBusinessSlug)}`
    : firstPaidSlug
      ? (() => {
          const billingPath = pathsConfig.app.accountBilling.replace(
            '[account]',
            firstPaidSlug!,
          );
          const query = new URLSearchParams({ setup: '1' });
          if (options?.billingIntent?.productId) {
            query.set('product', options.billingIntent.productId);
          }
          if (options?.billingIntent?.planId) {
            query.set('plan', options.billingIntent.planId);
          }
          if (options?.billingIntent?.interval) {
            query.set('interval', options.billingIntent.interval);
          }
          if (
            options?.billingIntent?.seats != null &&
            options.billingIntent.seats >= 1
          ) {
            query.set('seats', String(Math.floor(options.billingIntent.seats)));
          }
          return `${billingPath}?${query.toString()}`;
        })()
      : firstTeamSlug
        ? pathsConfig.app.accountHome.replace('[account]', firstTeamSlug)
        : pathsConfig.app.home;

  return {
    success: true,
    redirectTo,
    billingRequired: Boolean(firstPaidSlug) && !firstBusinessSlug,
    accountId: firstBusinessAccountId ?? undefined,
    accountSlug:
      firstBusinessSlug ?? firstPaidSlug ?? firstTeamSlug ?? undefined,
  };
}
