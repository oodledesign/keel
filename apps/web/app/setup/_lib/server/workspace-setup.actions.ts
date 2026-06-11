'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  businessTypeForProfile,
  spaceTypeForProfile,
  type WorkspaceProfile,
} from '~/home/[account]/_lib/server/workspace-profile';
import pathsConfig from '~/config/paths.config';
import { requiredEntitlementForProfile } from '~/lib/billing/keel-plan-catalog';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type WorkspaceSetupSelection = {
  profile: WorkspaceProfile;
  name: string;
};

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(
  admin: ReturnType<typeof getSupabaseServerAdminClient>,
  base: string,
): Promise<string> {
  let candidate = base || 'workspace';
  let n = 0;
  for (;;) {
    const { data } = await admin
      .from('accounts')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

export async function completeWorkspaceSetup(
  selections: WorkspaceSetupSelection[],
  options?: {
    billingIntent?: {
      productId: string;
      planId: string;
      interval?: 'month' | 'year';
    };
  },
): Promise<{
  error?: string;
  success?: boolean;
  redirectTo?: string;
  billingRequired?: boolean;
}> {
  if (!selections.length) {
    return { error: 'Select at least one workspace type.' };
  }

  const user = await requireUserInServerComponent();
  const admin = getSupabaseServerAdminClient();
  const client = getSupabaseServerClient();

  const useWork = selections.some(
    (s) => s.profile === 'work_design' || s.profile === 'work_property',
  );
  const useFamily = selections.some((s) => s.profile === 'family');
  const useCommunity = selections.some((s) => s.profile === 'community');

  let firstTeamSlug: string | null = null;
  let firstPaidSlug: string | null = null;

  for (const sel of selections) {
    const name = sel.name.trim();
    if (!name) {
      return { error: 'Every workspace needs a name.' };
    }

    const baseSlug = slugifyName(name);
    const slug = await uniqueSlug(admin, baseSlug);
    const spaceType = spaceTypeForProfile(sel.profile);
    const businessType = businessTypeForProfile(sel.profile);

    const { data: account, error } = await admin.rpc('create_team_account', {
      account_name: name,
      user_id: user.id,
      account_slug: slug,
      account_space_type: spaceType,
      account_business_type: businessType,
      account_complete_onboarding: true,
    });

    if (error) {
      console.error('[workspace-setup] create_team_account:', error.message);
      return { error: error.message };
    }

    const createdSlug = (account as { slug?: string | null } | null)?.slug?.trim();
    if (!firstTeamSlug && createdSlug) {
      firstTeamSlug = createdSlug;
    }
    if (
      !firstPaidSlug &&
      createdSlug &&
      requiredEntitlementForProfile(sel.profile)
    ) {
      firstPaidSlug = createdSlug;
    }
  }

  await client.from('user_settings').upsert({
    user_id: user.id,
    use_keel_for_work: useWork,
    use_keel_for_family: useFamily,
    use_keel_for_community: useCommunity,
  });

  // Mark every membership complete (cleans up duplicate workspaces from earlier retries).
  const { error: memErr } = await admin
    .from('accounts_memberships')
    .update({ onboarding_completed: true })
    .eq('user_id', user.id);

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

  const redirectTo = firstPaidSlug
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
        return `${billingPath}?${query.toString()}`;
      })()
    : firstTeamSlug
      ? pathsConfig.app.accountHome.replace('[account]', firstTeamSlug)
      : pathsConfig.app.home;

  return {
    success: true,
    redirectTo,
    billingRequired: Boolean(firstPaidSlug),
  };
}
