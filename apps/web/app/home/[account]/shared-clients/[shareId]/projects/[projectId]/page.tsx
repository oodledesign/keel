import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { createPartnerCostLinesService } from '~/lib/projects/partner-cost-lines.service';
import { assertPartnerProjectAccess } from '~/lib/projects/partner-projects.loader';

import { TeamAccountLayoutPageHeader } from '../../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../../_lib/server/team-account-workspace.loader';
import { PartnerProjectShell } from './_components/partner-project-shell';

export const generateMetadata = async () => ({ title: 'Partner project' });

async function PartnerSharedProjectPage({
  params,
}: {
  params: Promise<{ account: string; shareId: string; projectId: string }>;
}) {
  const { account: accountSlug, shareId, projectId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = await assertPartnerProjectAccess({
    guestAccountId: workspace.account.id,
    shareId,
    projectId,
  });

  if (!access) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const { data: tasks } = await client
    .from('tasks')
    .select(
      'id, title, status, priority, due_date, user_id, notes, sort_order, created_at',
    )
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  const costService = createPartnerCostLinesService(client);
  const costLines = await costService.listForPartner({
    shareId,
    projectId,
    partnerAccountId: access.partnerAccountId,
  });

  const backHref = pathsConfig.app.accountSharedClientDetail
    .replace('[account]', accountSlug)
    .replace('[shareId]', shareId);
  const sharedClientsHref = pathsConfig.app.accountSharedClients.replace(
    '[account]',
    accountSlug,
  );
  const clientLabel =
    access.clientName ?? access.ownerAccountName ?? 'Shared client';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={access.projectName}
        description={`Partner project · ${access.ownerAccountName ?? 'Host workspace'}`}
        account={accountSlug}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
            <Link
              href={sharedClientsHref}
              className="hover:text-[var(--workspace-shell-text)]"
            >
              Shared clients
            </Link>
            <span>/</span>
            <Link
              href={backHref}
              className="hover:text-[var(--workspace-shell-text)]"
            >
              {clientLabel}
            </Link>
            <span>/</span>
            <span className="text-[var(--workspace-shell-text)]">
              {access.projectName}
            </span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Board and costs for this shared client project. Also listed under{' '}
              <Link
                href={pathsConfig.app.accountProjects.replace(
                  '[account]',
                  accountSlug,
                )}
                className="text-[var(--ozer-accent)] hover:underline"
              >
                Projects
              </Link>
              .
            </p>
            <Link
              href={backHref}
              className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
            >
              ← Back to shared client
            </Link>
          </div>

          <PartnerProjectShell
            accountSlug={accountSlug}
            projectId={projectId}
            ownerAccountId={access.ownerAccountId}
            partnerAccountId={access.partnerAccountId}
            shareId={shareId}
            initialTasks={(tasks ?? []) as Array<Record<string, unknown>>}
            initialCostLines={costLines}
          />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(PartnerSharedProjectPage);
