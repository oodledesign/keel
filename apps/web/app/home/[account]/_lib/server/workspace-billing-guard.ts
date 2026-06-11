'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { redirectIfWorkspaceBillingRequired } from '~/lib/billing/workspace-billing-guard';

import { loadTeamWorkspace } from './team-account-workspace.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

/**
 * Redirects to workspace billing when a paid workspace has no active plan.
 * Skips billing routes via pathname header set in middleware.
 */
export async function enforceWorkspaceBilling(accountSlug: string) {
  const headerStore = await headers();
  const pathname =
    headerStore.get('x-pathname') ??
    headerStore.get('x-url') ??
    headerStore.get('next-url') ??
    headerStore.get('referer') ??
    '';

  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const workspace = await loadTeamWorkspace(accountSlug);

  await redirectIfWorkspaceBillingRequired(
    client,
    user.id,
    accountSlug,
    workspace,
    pathname,
  );
}
