import 'server-only';

import { revalidatePath } from 'next/cache';

import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type MealPlanScope =
  | {
      kind: 'personal';
      userId: string;
      basePath: string;
      revalidatePath: string;
    }
  | {
      kind: 'workspace';
      userId: string;
      accountId: string;
      accountSlug: string;
      basePath: string;
      revalidatePath: string;
    };

const PERSONAL_BASE_PATH = '/app/life/family';
const PERSONAL_REVALIDATE_PATH = '/home/life/family';

export function revalidateMealPlanPaths(scope: MealPlanScope) {
  revalidatePath(scope.revalidatePath);

  // Public /app/* URLs rewrite to /home/* — invalidate both route caches.
  revalidatePath(scope.basePath);
}

export async function resolveMealPlanScope(
  accountSlug?: string,
): Promise<MealPlanScope> {
  const user = await requireUserInServerComponent();

  if (!accountSlug) {
    return {
      kind: 'personal',
      userId: user.id,
      basePath: PERSONAL_BASE_PATH,
      revalidatePath: PERSONAL_REVALIDATE_PATH,
    };
  }

  const client = getSupabaseServerClient();
  const api = createTeamAccountsApi(client);
  const workspace = await api.getAccountWorkspace(accountSlug);

  if (workspace.error || !workspace.data?.account) {
    throw new Error('Could not load family workspace');
  }

  const accountId = (workspace.data.account as { id: string }).id;
  const basePath = pathsConfig.app.accountMealPlan.replace(
    '[account]',
    accountSlug,
  );

  return {
    kind: 'workspace',
    userId: user.id,
    accountId,
    accountSlug,
    basePath,
    revalidatePath: `/home/${accountSlug}/meal-plan`,
  };
}
