import 'server-only';

import { redirect } from 'next/navigation';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import type { TeamAccountWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/workspace-profile';

import { canEnterWorkspace, checkAccountAccess } from './check-account-access';
import { canAccessPaidWorkspace } from './entitlements';
import { requiredEntitlementForProfile } from './ozer-plan-catalog';

function isBillingRoute(pathname: string, accountSlug: string): boolean {
  if (!pathname) {
    return false;
  }

  let path = pathname;
  try {
    path = new URL(pathname, 'http://localhost').pathname;
  } catch {
    // already a path
  }

  const billingBase = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );
  const returnBase = pathsConfig.app.accountBillingReturn.replace(
    '[account]',
    accountSlug,
  );

  if (path === billingBase || path.startsWith(`${billingBase}/`)) {
    return true;
  }

  if (path === returnBase || path.startsWith(`${returnBase}/`)) {
    return true;
  }

  // Pathname headers may use /home/{slug}/… while pathsConfig uses /app/{slug}/…
  const slugEscaped = accountSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const homeBilling = new RegExp(
    `/(?:home|app)/${slugEscaped}/settings/billing(?:/|$)`,
  );
  const homeReturn = new RegExp(
    `/(?:home|app)/${slugEscaped}/billing/return(?:/|$)`,
  );

  return homeBilling.test(path) || homeReturn.test(path);
}

export async function redirectIfWorkspaceBillingRequired(
  client: SupabaseClient,
  userId: string,
  accountSlug: string,
  workspace: TeamAccountWorkspace,
  pathname: string,
): Promise<void> {
  const profile = workspace.workspaceProfile;
  const required = requiredEntitlementForProfile(profile);

  if (!required) {
    return;
  }

  if (isBillingRoute(pathname, accountSlug)) {
    return;
  }

  const accountId = workspace.account.id;
  const access = await checkAccountAccess(client, accountId, { userId });

  // Restricted stays in the shell (read-mostly); suspended/canceled/expired → billing.
  if (access.billing?.subscription_status) {
    if (canEnterWorkspace(access)) {
      return;
    }

    redirect(
      `${pathsConfig.app.accountBilling.replace('[account]', accountSlug)}?billing=1`,
    );
  }

  const allowed = await canAccessPaidWorkspace(
    client,
    userId,
    accountId,
    profile,
  );

  if (!allowed) {
    redirect(
      `${pathsConfig.app.accountBilling.replace('[account]', accountSlug)}?setup=1`,
    );
  }
}

export function isPaidWorkspaceProfile(
  workspace: TeamAccountWorkspace,
): boolean {
  const profile = workspace.workspaceProfile;
  return requiredEntitlementForProfile(profile) !== null;
}

export function workspaceProfileLabel(workspace: TeamAccountWorkspace): string {
  const type = spaceTypeFromProfile(workspace.workspaceProfile);
  if (type === 'family') return 'Family';
  if (type === 'community') return 'Community';
  if (workspace.workspaceProfile === 'work_property') return 'Property';
  return 'Business';
}
