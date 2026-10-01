import { type NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  DisposalsExportOptionsSchema,
  EXPORT_FORMATS,
  buildDisposalsExportTable,
  buildExportSnapshot,
  exportTableToCsv,
  exportTableToSheet,
  toTextTable,
  unknownExportColumns,
} from '~/lib/commercial/disposals-export';
import { chooseBaseline } from '~/lib/commercial/disposals-export-changes';
import { buildExportPdf } from '~/lib/commercial/disposals-export-pdf';
import {
  loadStoredSnapshots,
  rollSnapshotForward,
  userSnapshotKey,
} from '~/lib/commercial/disposals-export-snapshots.server';
import {
  loadDisposalsScheduleInput,
  resolveScheduleAccess,
} from '~/lib/commercial/load-disposals-schedule.server';
import { looseClient } from '~/lib/retainers/loose-client';
import { buildXlsxWorkbook } from '~/lib/spreadsheet/xlsx-workbook';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  accountId: z.string().uuid(),
  format: z.enum(EXPORT_FORMATS),
  options: DisposalsExportOptionsSchema,
});

const NO_STORE = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function generatedAtLabel(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date())
    .replace(',', '');
}

/**
 * Availability schedule with the columns, offices and statuses the caller
 * picked, as xlsx, csv, pdf, or json (which the dialog turns into a print
 * view). RLS scopes rows to the caller's workspace.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid request', { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response('Invalid export options', { status: 400 });
  }
  const { accountId, format, options } = parsed.data;

  const unknown = unknownExportColumns(options.columns);
  if (unknown.length > 0) {
    return new Response(`Unknown columns: ${unknown.join(', ')}`, {
      status: 400,
    });
  }

  const client = getSupabaseServerClient() as SupabaseClient;
  const access = await resolveScheduleAccess(client, accountId);
  if (!access.ok) return access.response;

  try {
    const input = await loadDisposalsScheduleInput({
      client,
      accountId,
      accountSlug: access.accountSlug,
      userId: access.userId,
      canSeeRestricted: access.canSeeRestricted,
    });

    // Change tracking is a bonus: if it fails, the export still goes out.
    const snapshots = looseClient(getSupabaseServerAdminClient());
    const snapshotKey = userSnapshotKey(access.userId, options);
    const now = new Date();
    let stored = null;
    let baseline = null;
    let rollForward = true;
    try {
      stored = await loadStoredSnapshots(snapshots, accountId, snapshotKey);
      ({ baseline, rollForward } = chooseBaseline(stored, now));
    } catch (error) {
      const logger = await getLogger();
      logger.warn(
        {
          name: 'disposals.export.snapshot',
          accountId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Could not load the previous export snapshot',
      );
    }

    const table = buildDisposalsExportTable(
      input,
      options,
      generatedAtLabel(),
      options.compareToLast ? { baseline } : null,
    );
    if (table.rowCount === 0) {
      return new Response('No disposals match these filters', { status: 422 });
    }

    if (rollForward) {
      try {
        await rollSnapshotForward(snapshots, {
          accountId,
          key: snapshotKey,
          snapshot: buildExportSnapshot(input, options),
          stored,
          now,
        });
      } catch (error) {
        const logger = await getLogger();
        logger.warn(
          {
            name: 'disposals.export.snapshot',
            accountId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Could not save the export snapshot',
        );
      }
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `availability-schedule-${date}`;

    switch (format) {
      case 'json':
        return NextResponse.json(toTextTable(table), { headers: NO_STORE });
      case 'csv':
        return new Response(exportTableToCsv(table), {
          headers: {
            ...NO_STORE,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });
      case 'pdf': {
        const pdf = await buildExportPdf(toTextTable(table));
        return new Response(new Uint8Array(pdf), {
          headers: {
            ...NO_STORE,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          },
        });
      }
      default: {
        const workbook = buildXlsxWorkbook([exportTableToSheet(table)]);
        return new Response(new Uint8Array(workbook), {
          headers: {
            ...NO_STORE,
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
          },
        });
      }
    }
  } catch (error) {
    const logger = await getLogger();
    logger.error(
      {
        name: 'disposals.export',
        accountId,
        format,
        error: error instanceof Error ? error.message : String(error),
      },
      'Disposals export failed',
    );
    return new Response('Could not build the export', { status: 500 });
  }
}
