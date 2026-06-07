import Link from 'next/link';

import { ranklyProjectPaths } from '../_lib/rankly-project-paths';
import type { SiteOverviewSnapshot } from '~/lib/site-overview/types';

function StatCard(props: {
  label: string;
  value: string | number;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="rounded-lg border border-white/10 bg-black/20 p-4 transition-colors hover:border-white/20 hover:bg-black/30"
    >
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{props.value}</p>
      {props.hint ? (
        <p className="text-muted-foreground mt-1 text-xs">{props.hint}</p>
      ) : null}
    </Link>
  );
}

export function RanklyProjectDashboard(props: {
  account: string;
  projectId: string;
  keywordCount: number;
  overview: SiteOverviewSnapshot | null;
  pagespeedMobileScore: number | null;
  pagespeedDesktopScore: number | null;
  countryLabel: string;
}) {
  const paths = ranklyProjectPaths(props.account, props.projectId);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Project overview</h1>
        <p className="text-muted-foreground text-sm">
          {props.countryLabel} market · quick snapshot across Rankly tools
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Keywords tracked"
          value={props.keywordCount}
          hint="Open keyword tracking →"
          href={paths.keywords}
        />
        <StatCard
          label="Domain Power"
          value={props.overview?.domainPower ?? '—'}
          hint="Site Explorer →"
          href={paths.siteExplorer}
        />
        <StatCard
          label="Organic traffic"
          value={
            props.overview
              ? props.overview.organicTraffic.toLocaleString()
              : '—'
          }
          hint="ETV / month"
          href={paths.siteExplorer}
        />
        <StatCard
          label="PageSpeed (mobile)"
          value={props.pagespeedMobileScore ?? '—'}
          hint={
            props.pagespeedDesktopScore != null
              ? `Desktop ${props.pagespeedDesktopScore}`
              : 'Run PageSpeed →'
          }
          href={paths.pagespeed}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            title: 'Keyword tracking',
            body: 'SERP positions, refresh schedule, and rank history.',
            href: paths.keywords,
          },
          {
            title: 'Site Explorer',
            body: 'Authority, traffic, backlinks, and AI visibility metrics.',
            href: paths.siteExplorer,
          },
          {
            title: 'PageSpeed Insights',
            body: 'Lighthouse scores and Core Web Vitals for key URLs.',
            href: paths.pagespeed,
          },
          {
            title: 'AI Search Audit',
            body: 'Entity, content, and technical readiness for AI citations.',
            href: paths.aiAudit,
          },
          {
            title: 'Content briefs',
            body: 'Writer-ready SEO briefs from SERP analysis.',
            href: paths.briefs,
          },
          {
            title: 'Keyword clusters',
            body: 'Pillar + spoke architecture from seed keywords.',
            href: paths.clusters,
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-5 transition-colors hover:border-white/20 hover:bg-black/20"
          >
            <h2 className="font-semibold">{card.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
