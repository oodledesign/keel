'use client';

import Link from 'next/link';

import { ClipboardList, FileText, Mic, UserRound } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { SurveyorDashboardData } from '../_lib/server/surveyor-dashboard.loader';

function accountPath(accountSlug: string, template: string) {
  return template.replace('[account]', accountSlug);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SurveyorDashboard({
  accountSlug,
  enquiryCount,
  bookedCount,
  surveyedCount,
  openEnquiryCount,
  recentSurveys,
}: SurveyorDashboardData) {
  const enquiriesHref = accountPath(
    accountSlug,
    pathsConfig.app.accountPipeline,
  );
  const surveysHref = accountPath(accountSlug, pathsConfig.app.accountSurveys);
  const transcriptsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountMeetings,
  );
  const clientsHref = accountPath(accountSlug, pathsConfig.app.accountClients);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-5 pb-10 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Surveyor home</h2>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Enquiries, site transcripts, and building survey reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className={workspaceBtnPrimaryMd}>
            <Link href={`${surveysHref}?create=1`}>New survey</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`${transcriptsHref}?create=1`}>Paste transcript</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          href={enquiriesHref}
          label="Open enquiries"
          value={openEnquiryCount}
          icon={ClipboardList}
        />
        <MetricCard
          href={enquiriesHref}
          label="New enquiries"
          value={enquiryCount}
          icon={ClipboardList}
        />
        <MetricCard
          href={enquiriesHref}
          label="Booked"
          value={bookedCount}
          icon={UserRound}
        />
        <MetricCard
          href={surveysHref}
          label="Surveyed"
          value={surveyedCount}
          icon={FileText}
        />
      </div>

      <Card className={workspacePanelCard}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Recent surveys</h3>
            <Link
              href={surveysHref}
              className={`text-sm ${workspaceLinkAccent}`}
            >
              View all
            </Link>
          </div>
          {recentSurveys.length === 0 ? (
            <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
              No survey reports yet. Create one from an enquiry or paste a site
              transcript to draft the RICS headings.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[color:var(--workspace-shell-border)]">
              {recentSurveys.map((survey) => (
                <li key={survey.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={pathsConfig.app.accountSurveyEdit
                      .replace('[account]', accountSlug)
                      .replace('[id]', survey.id)}
                    className="flex items-center justify-between gap-3 hover:underline"
                  >
                    <span>
                      <span className="font-medium">{survey.title}</span>
                      {survey.clientName ? (
                        <span
                          className={`mt-0.5 block text-xs ${workspaceTextMuted}`}
                        >
                          {survey.clientName}
                        </span>
                      ) : null}
                    </span>
                    <span className={`text-xs ${workspaceTextMuted}`}>
                      {formatDate(survey.updatedAt)} · {survey.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <QuickLink
          href={`${enquiriesHref}?create=lead`}
          label="New enquiry"
          description="Add an enquiry to the pipeline"
          icon={ClipboardList}
        />
        <QuickLink
          href={`${transcriptsHref}?create=1`}
          label="Paste transcript"
          description="Use the existing meetings paste flow"
          icon={Mic}
        />
        <QuickLink
          href={clientsHref}
          label="Clients"
          description="Shared client records for the team"
          icon={UserRound}
        />
      </div>
    </div>
  );
}

function MetricCard({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card
        className={`${workspacePanelCard} h-full transition-colors hover:border-[var(--ozer-accent)]/35`}
      >
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--workspace-shell-sidebar-accent)]">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className={`text-sm ${workspaceTextMuted}`}>{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickLink({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card
        className={`${workspacePanelCard} h-full transition-colors hover:border-[var(--ozer-accent)]/35`}
      >
        <CardContent className="flex items-start gap-3 p-4">
          <Icon className="mt-0.5 h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
