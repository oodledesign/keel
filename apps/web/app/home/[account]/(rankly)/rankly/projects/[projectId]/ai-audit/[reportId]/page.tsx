import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { loadAuditReportBundle } from '~/lib/ai-audit/db';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import { AuditReportView } from '../../../../../_components/ai-audit/audit-report-view';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';
import { SeoReportSharePanel } from '../../../../../_components/seo-report-share-panel';

type RanklyAiAuditReportPageProps = {
  params: Promise<{ account: string; projectId: string; reportId: string }>;
};

function auditPath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectAiAudit
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

export default async function RanklyAiAuditReportPage({
  params,
}: RanklyAiAuditReportPageProps) {
  const { account, projectId, reportId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const user = await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) notFound();

  const bundle = await loadAuditReportBundle(reportId, user.id);
  if (!bundle || bundle.report.project_id !== projectId) notFound();

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title="AI Search Audit report"
        description={bundle.report.target_domain}
      />

      <SeoReportSharePanel
        accountId={accountId}
        projectId={projectId}
        compact
      />

      <AuditReportView
        report={bundle.report}
        recommendations={bundle.recommendations}
      />

      <Link
        href={auditPath(account, projectId)}
        className="text-primary inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Back to AI Search Audit
      </Link>
    </div>
  );
}
