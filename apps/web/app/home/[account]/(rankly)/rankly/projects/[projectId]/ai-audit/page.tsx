import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { AuditJobPoller } from '../../../../_components/ai-audit/audit-job-poller';
import {
  AuditReportList,
  AuditReportView,
} from '../../../../_components/ai-audit/audit-report-view';
import { AuditLauncher } from '../../../../_components/ai-audit/audit-launcher';
import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import {
  loadAuditReportsForProject,
  loadLatestAuditForProject,
  loadScoreHistory,
} from '~/lib/ai-audit/db';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

type RanklyAiAuditPageProps = {
  params: Promise<{ account: string; projectId: string }>;
  searchParams: Promise<{ jobId?: string }>;
};

function auditPath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectAiAudit
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

export default async function RanklyAiAuditPage({
  params,
  searchParams,
}: RanklyAiAuditPageProps) {
  const { account, projectId } = await params;
  const { jobId } = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const user = await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) notFound();

  const base = auditPath(account, projectId);
  const latest = jobId ? null : await loadLatestAuditForProject(projectId, user.id);
  const reports = await loadAuditReportsForProject(projectId, user.id);
  const scoreTrend = await loadScoreHistory(projectId, user.id);

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title="AI Search Audit"
        description="Score entity, content, E-E-A-T, and technical readiness for AI search citations."
      />

      {jobId ? (
        <AuditJobPoller jobId={jobId} auditPath={base} />
      ) : (
        <>
          <AuditLauncher
            accountId={accountId}
            projectId={projectId}
            targetDomain={project.domain}
            auditPath={base}
            lastRun={
              latest
                ? {
                    overall_score: latest.report.overall_score,
                    created_at: latest.report.created_at,
                    reportId: latest.report.id,
                  }
                : null
            }
            scoreTrend={scoreTrend.map((row) => ({
              overall_score: row.overall_score,
              run_at: row.run_at,
            }))}
          />

          {latest ? (
            <AuditReportView
              report={latest.report}
              recommendations={latest.recommendations}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No audit yet. Run your first AI Search Audit to score entity,
              content, E-E-A-T, and technical readiness for AI citations.
            </p>
          )}
        </>
      )}

      {!jobId ? <AuditReportList reports={reports} auditPath={base} /> : null}
    </div>
  );
}
