import Link from 'next/link';

import type { LucideIcon } from 'lucide-react';

import { RANKLY_DASHBOARD_TOOL_SECTIONS, getRanklySection } from '../_lib/rankly-project-sections';
import { ranklyProjectPaths } from '../_lib/rankly-project-paths';
import type { SiteOverviewSnapshot } from '~/lib/site-overview/types';

function SectionIcon(props: { icon: LucideIcon }) {
  const Icon = props.icon;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
      <Icon className="h-4 w-4 text-[var(--ozer-accent)]" aria-hidden />
    </span>
  );
}

function StatCard(props: {
  label: string;
  value: string | number;
  hint?: string;
  href: string;
  icon: LucideIcon;
}) {
  const Icon = props.icon;

  return (
    <Link
      href={props.href}
      className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 transition-colors hover:border-[color:var(--workspace-shell-border)] hover:bg-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">
          {props.label}
        </p>
        <Icon className="text-muted-foreground h-4 w-4 shrink-0 opacity-80" aria-hidden />
      </div>
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
  const keywordsSection = getRanklySection('keywords');
  const siteExplorerSection = getRanklySection('siteExplorer');
  const pagespeedSection = getRanklySection('pagespeed');

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
          icon={keywordsSection.icon}
        />
        <StatCard
          label="Domain Power"
          value={props.overview?.domainPower ?? '—'}
          hint="Site Explorer →"
          href={paths.siteExplorer}
          icon={siteExplorerSection.icon}
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
          icon={siteExplorerSection.icon}
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
          icon={pagespeedSection.icon}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {RANKLY_DASHBOARD_TOOL_SECTIONS.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.id}
              href={paths[section.pathKey]}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-5 transition-colors hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <div className="flex items-start gap-3">
                <SectionIcon icon={Icon} />
                <div className="min-w-0">
                  <h2 className="font-semibold">{section.dashboardTitle}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {section.dashboardBody}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
