import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import { AuditReportView } from '../../../../../_components/ai-audit/audit-report-view';
import { TeamAccountLayoutPageHeader } from '../../../../../../_components/team-account-layout-page-header';
import { loadAuditReportBundle } from '~/lib/ai-audit/db';
import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

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
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="AI Search Audit report"
        description={bundle.report.target_domain}
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <AuditReportView
          report={bundle.report}
          recommendations={bundle.recommendations}
        />

        <Link
          href={auditPath(account, projectId)}
          className="inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Back to AI Search Audit
        </Link>
      </PageBody>
    </>
  );
}
