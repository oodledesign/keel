import 'server-only';

import { redirect } from 'next/navigation';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import type { TeamAccountWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/server/workspace-profile';

import { canAccessPaidWorkspace } from './entitlements';
import { requiredEntitlementForProfile } from './keel-plan-catalog';

const BILLING_PATH_SEGMENTS = ['/billing', '/billing/return'];

function isBillingRoute(pathname: string, accountSlug: string): boolean {
  if (!pathname) {
    return false;
  }

  if (BILLING_PATH_SEGMENTS.some((segment) => pathname.includes(segment))) {
    return true;
  }

  const billingBase = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  return (
    pathname === billingBase || pathname.startsWith(`${billingBase}/`)
  );
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

  const allowed = await canAccessPaidWorkspace(
    client,
    userId,
    workspace.account.id,
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
