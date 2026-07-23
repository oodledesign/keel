import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { loadSeoReportByPublicToken } from '~/lib/rankly-seo-report/db';
import { buildSeoReportPdfUrl } from '~/lib/rankly-seo-report/public-url';

import { SeoReportView } from '../_components/seo-report-view';

type PortalSeoReportPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PortalSeoReportPageProps) {
  const { token } = await params;
  const report = await loadSeoReportByPublicToken(token);
  if (!report) {
    return { title: 'SEO report not found' };
  }

  return {
    title: `${report.title} · ${report.target_domain}`,
    description:
      report.snapshot.executiveSummary?.slice(0, 160) ||
      `SEO report for ${report.target_domain}`,
  };
}

export default async function PortalSeoReportPage({
  params,
}: PortalSeoReportPageProps) {
  const { token } = await params;
  const report = await loadSeoReportByPublicToken(token);
  if (!report) {
    notFound();
  }

  const admin = getSupabaseServerAdminClient();
  const [{ data: account }, brand] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', report.account_id)
      .maybeSingle(),
    loadAccountBrandResolved(report.account_id),
  ]);

  return (
    <div className="min-h-screen bg-[var(--ozer-cream-50,#FBF6EC)] text-zinc-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <SeoReportView
          snapshot={report.snapshot}
          brandName={account?.name ?? null}
          logoUrl={brand.logo_url}
          pdfUrl={buildSeoReportPdfUrl(token)}
        />
        <p className="mt-12 text-center text-xs text-zinc-400">
          Prepared with Rankly by{' '}
          <a
            href="https://ozer.so"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
          >
            Ozer
          </a>
          . Potential scores are estimates based on recommended actions.
        </p>
      </div>
    </div>
  );
}
