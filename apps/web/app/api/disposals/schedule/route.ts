import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildDisposalsScheduleSheets } from '~/lib/commercial/disposals-schedule';
import {
  loadDisposalsScheduleInput,
  resolveScheduleAccess,
} from '~/lib/commercial/load-disposals-schedule.server';
import { buildXlsxWorkbook } from '~/lib/spreadsheet/xlsx-workbook';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Full disposals schedule (all statuses) as an xlsx workbook with a Disposals
 * sheet and a Units sheet. RLS scopes rows to the caller's workspace.
 */
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId');
  const client = getSupabaseServerClient() as SupabaseClient;
  const access = await resolveScheduleAccess(client, accountId);
  if (!access.ok) return access.response;

  try {
    const input = await loadDisposalsScheduleInput({
      client,
      accountId: accountId!,
      accountSlug: access.accountSlug,
      userId: access.userId,
      canSeeRestricted: access.canSeeRestricted,
    });

    const workbook = buildXlsxWorkbook(buildDisposalsScheduleSheets(input));
    const date = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(workbook), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="disposals-schedule-${date}.xlsx"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const logger = await getLogger();
    logger.error(
      {
        name: 'disposals.schedule.export',
        accountId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Disposals schedule export failed',
    );
    return new Response('Could not build the disposals schedule', {
      status: 500,
    });
  }
}
