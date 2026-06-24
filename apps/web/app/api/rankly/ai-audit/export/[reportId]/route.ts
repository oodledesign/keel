import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAuditReportBundle } from '~/lib/ai-audit/db';
import {
  DIMENSION_LABELS,
  type AuditRecommendationRow,
  type AuditReportRow,
} from '~/lib/ai-audit/types';
import { jsonErr } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExportHtml(
  report: AuditReportRow,
  recommendations: AuditRecommendationRow[],
): string {
  const date = new Date(report.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const recsHtml = recommendations
    .map(
      (rec) => `
    <section class="rec">
      <h3>${escapeHtml(rec.title)} <span class="badge ${rec.priority}">${rec.priority}</span> <span class="badge cat">${rec.dimension}</span>${rec.is_quick_win ? ' <span class="badge quick">Quick win</span>' : ''}</h3>
      <p>${escapeHtml(rec.description)}</p>
      ${rec.outcome ? `<p><strong>Outcome:</strong> ${escapeHtml(rec.outcome)}</p>` : ''}
      ${rec.example_urls?.length ? `<p><strong>Pages:</strong> ${rec.example_urls.map(escapeHtml).join(', ')}</p>` : ''}
    </section>`,
    )
    .join('');

  const platformHtml =
    (report.ai_citations_by_platform ?? [])
      .map(
        (platform) =>
          `<tr><td>${escapeHtml(platform.label)}</td><td>${platform.domainCitedInAny ? 'Yes' : 'No'}</td><td>${escapeHtml(platform.citedQueries.join(', ') || '—')}</td></tr>`,
      )
      .join('') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AI Search Audit — ${escapeHtml(report.target_domain)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; color: #111; line-height: 1.5; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .meta { color: #555; margin-bottom: 2rem; }
    .scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0; }
    .score { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; text-align: center; }
    .score strong { display: block; font-size: 2rem; }
    .summary { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    .rec { border-top: 1px solid #eee; padding: 1rem 0; }
    .badge { font-size: 0.7rem; text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: 4px; background: #eee; }
    .high { background: #fee; }
    .medium { background: #fef3cd; }
    .low { background: #f0f0f0; }
    .quick { background: #e0f7fa; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>AI Search Audit</h1>
  <p class="meta">${escapeHtml(report.target_domain)} · ${date}</p>
  <div class="summary">${escapeHtml(report.executive_summary ?? '')}</div>
  <div class="scores">
    <div class="score"><span>${DIMENSION_LABELS.entity}</span><strong>${report.score_entity ?? '—'}</strong></div>
    <div class="score"><span>${DIMENSION_LABELS.content}</span><strong>${report.score_content ?? '—'}</strong></div>
    <div class="score"><span>${DIMENSION_LABELS.eeat}</span><strong>${report.score_eeat ?? '—'}</strong></div>
    <div class="score"><span>${DIMENSION_LABELS.tech}</span><strong>${report.score_tech ?? '—'}</strong></div>
  </div>
  <p><strong>Overall score:</strong> ${report.overall_score ?? '—'}/100</p>
  ${
    platformHtml
      ? `<h2>AI citations by platform</h2>
  <table style="width:100%; border-collapse: collapse; margin-bottom: 2rem;">
    <thead><tr style="border-bottom: 1px solid #ddd;"><th style="text-align:left; padding: 0.5rem;">Platform</th><th style="text-align:left; padding: 0.5rem;">Cited</th><th style="text-align:left; padding: 0.5rem;">Queries</th></tr></thead>
    <tbody>${platformHtml}</tbody>
  </table>`
      : ''
  }
  <h2>Recommendations</h2>
  ${recsHtml}
</body>
</html>`;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { reportId } = await context.params;
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const bundle = await loadAuditReportBundle(reportId, user.id);
    if (!bundle) {
      return jsonErr('NOT_FOUND', 'Report not found', 404);
    }

    const { data: reportRow } = await supabaseCustomSchema(client, 'rankly')
      .from('ai_audit_reports')
      .select('job_id')
      .eq('id', reportId)
      .maybeSingle();

    const { data: job } = reportRow
      ? await supabaseCustomSchema(client, 'rankly')
          .from('ai_audit_jobs')
          .select('project_id')
          .eq('id', reportRow.job_id)
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null };

    if (!job?.project_id) {
      return jsonErr('NOT_FOUND', 'Report not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      job.project_id as string,
    );
    if (addonDenied) return addonDenied;

    const html = buildExportHtml(bundle.report, bundle.recommendations);
    const filename = `AI-Search-Audit-${bundle.report.target_domain.replace(/\./g, '-')}-${new Date().toISOString().slice(0, 10)}.html`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
