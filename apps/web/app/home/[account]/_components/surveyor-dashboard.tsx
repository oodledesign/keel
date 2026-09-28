'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ClipboardList, FileText, Mic, Plus, UserRound } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { ProfileAvatar } from '@kit/ui/profile-avatar';

import { SurveyStatusBadge } from '~/components/surveys/survey-status-badge';
import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { SurveyorDashboardData } from '../_lib/server/surveyor-dashboard.loader';
import { CreateSurveyDialog } from '../surveys/_components/create-survey-dialog';

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
  accountId,
  accountSlug,
  canCreateSurvey,
  enquiryCount,
  bookedCount,
  surveyedCount,
  openPipelineCount,
  recentSurveys,
  pipelineDeals,
  dealOptions,
}: SurveyorDashboardData) {
  const [createOpen, setCreateOpen] = useState(false);
  const pipelineHref = accountPath(
    accountSlug,
    pathsConfig.app.accountPipeline,
  );
  const surveysHref = accountPath(accountSlug, pathsConfig.app.accountSurveys);
  const meetingsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountMeetings,
  );
  const clientsHref = accountPath(accountSlug, pathsConfig.app.accountClients);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-5 pb-10 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <StatPill
          href={pipelineHref}
          label="Open pipeline"
          value={openPipelineCount}
          icon={ClipboardList}
        />
        <StatPill
          href={pipelineHref}
          label="Enquiry"
          value={enquiryCount}
          icon={ClipboardList}
        />
        <StatPill
          href={pipelineHref}
          label="Booked"
          value={bookedCount}
          icon={UserRound}
        />
        <StatPill
          href={surveysHref}
          label="Surveyed"
          value={surveyedCount}
          icon={FileText}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-9 rounded-xl">
            <Link href={`${meetingsHref}?create=1`}>
              <Mic className="mr-2 h-4 w-4" />
              Add meeting
            </Link>
          </Button>
          {canCreateSurvey ? (
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={() => setCreateOpen(true)}
              data-test="surveyor-home-new-survey"
            >
              <Plus className="h-4 w-4" />
              New survey
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                No survey reports yet. Create one from a pipeline item or add a
                site meeting to draft the RICS headings.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--workspace-shell-border)]">
                {recentSurveys.map((survey) => (
                  <li key={survey.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={pathsConfig.app.accountSurveyDetail
                        .replace('[account]', accountSlug)
                        .replace('[id]', survey.id)}
                      className="group flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">
                          {survey.title}
                        </span>
                        <span
                          className={`mt-1 flex items-center gap-1.5 text-xs ${workspaceTextMuted}`}
                        >
                          {survey.createdBy ? (
                            <>
                              <ProfileAvatar
                                displayName={survey.createdBy.name}
                                pictureUrl={survey.createdBy.pictureUrl}
                                className="h-5 w-5 text-[10px]"
                              />
                              <span className="truncate">
                                {survey.createdBy.name}
                              </span>
                            </>
                          ) : null}
                          {survey.createdBy && survey.clientName ? (
                            <span aria-hidden>·</span>
                          ) : null}
                          {survey.clientName ? (
                            <span className="truncate">
                              {survey.clientName}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`text-xs ${workspaceTextMuted}`}>
                          {formatDate(survey.updatedAt)}
                        </span>
                        <SurveyStatusBadge status={survey.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={workspacePanelCard}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Pipeline</h3>
              <Link
                href={pipelineHref}
                className={`text-sm ${workspaceLinkAccent}`}
              >
                View all
              </Link>
            </div>
            {pipelineDeals.length === 0 ? (
              <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
                No open pipeline items yet. Add a lead to start a survey
                booking.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[color:var(--workspace-shell-border)]">
                {pipelineDeals.map((deal) => (
                  <li key={deal.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={pipelineHref}
                      className="flex items-center justify-between gap-3 hover:underline"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {deal.title}
                        </span>
                        {deal.clientName ? (
                          <span
                            className={`mt-0.5 block truncate text-xs ${workspaceTextMuted}`}
                          >
                            {deal.clientName}
                          </span>
                        ) : null}
                      </span>
                      <span className={`text-xs ${workspaceTextMuted}`}>
                        {deal.stageLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <QuickLink
          href={`${pipelineHref}?create=lead`}
          label="New pipeline item"
          description="Add a lead to the pipeline"
          icon={ClipboardList}
        />
        <QuickLink
          href={`${meetingsHref}?create=1`}
          label="Add meeting"
          description="Paste or record a site meeting"
          icon={Mic}
        />
        <QuickLink
          href={clientsHref}
          label="Clients"
          description="Shared client records for the team"
          icon={UserRound}
        />
      </div>

      {canCreateSurvey ? (
        <CreateSurveyDialog
          accountId={accountId}
          accountSlug={accountSlug}
          deals={dealOptions}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      ) : null}
    </div>
  );
}

function StatPill({
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
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 text-sm transition-colors hover:border-[var(--ozer-accent)]/35"
    >
      <Icon className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className={workspaceTextMuted}>{label}</span>
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
