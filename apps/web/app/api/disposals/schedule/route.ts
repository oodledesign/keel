import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildDisposalsScheduleSheets } from '~/lib/commercial/disposals-schedule';
import { loadDisposalsScheduleInput } from '~/lib/commercial/load-disposals-schedule.server';
import { buildXlsxWorkbook } from '~/lib/spreadsheet/xlsx-workbook';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXCLUDED_ROLES = new Set(['client', 'contractor']);

/**
 * Full disposals schedule (all statuses) as an xlsx workbook with a Disposals
 * sheet and a Units sheet. RLS scopes rows to the caller's workspace.
 */
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId');

  if (!accountId || !UUID_PATTERN.test(accountId)) {
    return new Response('A valid accountId is required', { status: 400 });
  }

  const client = getSupabaseServerClient() as SupabaseClient;
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return new Response('Sign in required', { status: 401 });
  }

  const [{ data: membership }, { data: account }] = await Promise.all([
    client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle(),
    client.from('accounts').select('slug').eq('id', accountId).maybeSingle(),
  ]);

  const role = membership?.account_role as string | undefined;
  if (!role || EXCLUDED_ROLES.has(role) || !account?.slug) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const input = await loadDisposalsScheduleInput({
      client,
      accountId,
      accountSlug: account.slug,
      userId: user.id,
      canSeeRestricted: role === 'owner' || role === 'admin',
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
