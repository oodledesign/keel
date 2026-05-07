import { enhanceRouteHandler } from '@kit/next/routes';

import { requireMergeAdmin } from '~/lib/platform-merge/auth';
import { getLatestSyncRuns } from '~/lib/platform-merge/sync';

export const GET = enhanceRouteHandler(async () => {
  const auth = await requireMergeAdmin();

  if (!auth.ok) {
    return Response.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const runs = await getLatestSyncRuns();

  return Response.json({
    runs,
    count: runs.length,
  });
});
