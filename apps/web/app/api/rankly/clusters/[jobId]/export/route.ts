import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadKeywordsForExport } from '~/lib/clusters/db';
import { jsonErr } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('keyword_cluster_jobs')
      .select('id, status, project_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    if (!job) {
      return jsonErr('NOT_FOUND', 'Job not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      job.project_id as string,
    );
    if (addonDenied) return addonDenied;

    const keywords = await loadKeywordsForExport(jobId);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('keyword,volume,kd,cpc,intent,cluster,role\n'),
        );

        for (const row of keywords) {
          const line = [
            csvEscape(row.keyword),
            row.volume ?? '',
            row.kd ?? '',
            row.cpc ?? '',
            row.intent ?? '',
            csvEscape(row.cluster_name ?? ''),
            row.role ?? '',
          ].join(',');
          controller.enqueue(encoder.encode(`${line}\n`));
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="clusters-${jobId}.csv"`,
      },
    });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
