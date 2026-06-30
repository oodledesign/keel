import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { ClientsPageContent } from '../../[account]/clients/_components/clients-page-content';
import { loadClientsPageData } from '../../[account]/clients/_lib/server/clients-page.loader';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../[account]/_lib/role-access';
import { loadTeamWorkspace } from '../../[account]/_lib/server/team-account-workspace.loader';
import { HomeAddAccountButton } from '../_components/home-add-account-button';
import { loadUserWorkspace } from '../_lib/server/load-user-workspace';

import { PersonalClientsAccountPicker } from './_components/personal-clients-account-picker';

type Props = { searchParams: Promise<{ account?: string }> };

/**
 * Personal Clients hub: pick a team workspace here, then add/manage clients for that workspace.
 * Avoids relying on `/home/[slug]/clients` when slugs or deep links misbehave — use `?account=slug`.
 */
async function PersonalClientsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { accounts, canCreateTeamAccount } = await loadUserWorkspace();

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return (
      <PageBody className="flex min-h-[60vh] items-center justify-center bg-[var(--workspace-shell-canvas)] px-0">
        <div className="max-w-md rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]">
            <Users className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
            <Trans i18nKey="common:routes.clients" />
          </h1>
          <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
            <Trans i18nKey="account:clientsNeedTeam" />
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]">
              <Link href={pathsConfig.app.home}>
                <Trans i18nKey="account:goToHome" />
              </Link>
            </Button>
            {canCreateTeamAccount?.allowed && (
              <HomeAddAccountButton
                canCreateTeamAccount={canCreateTeamAccount}
                className="border border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-control-surface)]"
              />
            )}
          </div>
        </div>
      </PageBody>
    );
  }

  const slug = sp.account?.trim() || accounts[0]?.value;
  if (!slug) {
    redirect(pathsConfig.app.home);
  }

  const slugIsMember = accounts.some((a) => a.value === slug);
  if (!slugIsMember && accounts[0]?.value) {
    redirect(
      `/app/clients?account=${encodeURIComponent(accounts[0].value)}`,
    );
  }

  const workspace = await loadTeamWorkspace(slug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewClients) {
    redirect(
      getDefaultAccountPath(slug, workspace.account as Parameters<typeof getDefaultAccountPath>[1]),
    );
  }

  const {
    accountId,
    canViewClients,
    canEditClients,
    isContractorView,
    initialOverview,
    initialTotal,
  } = await loadClientsPageData(slug);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-[color:var(--workspace-shell-border)] pb-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
              <Trans i18nKey="common:routes.clients" />
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
              Pick the workspace (team) these people belong to, then use{' '}
              <span className="text-[var(--workspace-shell-text-muted)]">Add Client</span>. Each client is
              stored under that workspace—the same one you use for jobs and
              billing.
            </p>
          </div>
          <PersonalClientsAccountPicker
            accounts={accounts}
            currentSlug={slug}
          />
        </div>
      </div>

      <ClientsPageContent
        accountSlug={slug}
        accountId={accountId}
        canViewClients={canViewClients}
        canEditClients={canEditClients}
        isContractorView={isContractorView}
        initialOverview={initialOverview}
        initialTotal={initialTotal}
      />
    </PageBody>
  );
}

export default withI18n(PersonalClientsPage);
