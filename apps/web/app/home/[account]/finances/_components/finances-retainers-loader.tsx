import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createWorkspaceRetainersService } from '~/home/[account]/retainers/_lib/server/workspace-retainers.service';
import type { WorkspaceRetainerRow } from '~/lib/retainers/workspace-retainers';

import { FinancesRetainersBlock } from './finances-retainers-block';

export async function FinancesRetainersLoader({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  let rows: WorkspaceRetainerRow[] = [];
  try {
    const data = await createWorkspaceRetainersService(
      getSupabaseServerClient(),
    ).list(accountId);
    rows = data.rows;
  } catch {
    rows = [];
  }

  return <FinancesRetainersBlock accountSlug={accountSlug} rows={rows} />;
}
