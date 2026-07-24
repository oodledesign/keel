import { type NextRequest } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadSeoReportByPublicToken } from '~/lib/rankly-seo-report/db';
import { buildSeoReportPdf } from '~/lib/rankly-seo-report/seo-report-pdf';
import { jsonErr } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!token?.trim()) {
      return jsonErr('NOT_FOUND', 'Report not found', 404);
    }

    const report = await loadSeoReportByPublicToken(token);
    if (!report) {
      return jsonErr('NOT_FOUND', 'Report not found', 404);
    }

    const admin = getSupabaseServerAdminClient();
    const { data: account } = await admin
      .from('accounts')
      .select('name')
      .eq('id', report.account_id)
      .maybeSingle();

    const pdfBytes = await buildSeoReportPdf({
      snapshot: report.snapshot,
      brandName: account?.name ?? null,
    });

    const safeDomain = report.target_domain.replace(/[^\w.-]+/g, '-');
    const filename = `SEO-AI-Search-Report-${safeDomain}-${report.created_at.slice(0, 10)}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('[rankly] seo-report PDF export', error);
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Failed to export PDF',
      500,
    );
  }
}
