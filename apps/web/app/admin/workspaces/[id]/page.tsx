import Link from 'next/link';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { Badge } from '@kit/ui/badge';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminBillingGrantsPanel } from '~/admin/accounts/[id]/_components/admin-billing-grants-panel';
import { loadAdminAccountBillingState } from '~/admin/accounts/[id]/_lib/load-admin-account-billing';

import { AdminWorkspaceMembersPanel } from './_components/admin-workspace-members-panel';
import { loadAdminWorkspaceDetail } from './_lib/load-admin-workspace';

interface Params {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async (props: Params) => {
  const { id } = await props.params;
  const workspace = await loadAdminWorkspaceDetail(id);
  return { title: `Admin | ${workspace.name}` };
};

async function AdminWorkspaceDetailPage(props: Params) {
  const { id } = await props.params;
  const workspace = await loadAdminWorkspaceDetail(id);
  const billing = await loadAdminAccountBillingState(workspace.id);

  return (
    <>
      <PageHeader
        title={workspace.name}
        description={
          <AppBreadcrumbs
            values={{
              workspaces: 'Workspaces',
              [workspace.id]: workspace.name,
            }}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{workspace.workspaceLabel}</Badge>
          <Badge variant="secondary">/{workspace.slug}</Badge>
          {billing.billingExempt ? (
            <Badge variant="secondary">Billing off</Badge>
          ) : null}
          <Link
            className="text-muted-foreground text-sm hover:underline"
            href={`/home/${workspace.slug}`}
          >
            Open workspace
          </Link>
        </div>
      </PageHeader>

      <PageBody className="space-y-8">
        <section className="mx-auto w-full max-w-4xl space-y-3 px-4">
          <h2 className="text-base font-semibold">Members</h2>
          <AdminWorkspaceMembersPanel
            accountId={workspace.id}
            members={workspace.members}
            invitations={workspace.invitations}
          />
        </section>

        <section className="mx-auto w-full max-w-4xl px-4">
          <AdminBillingGrantsPanel
            accountId={workspace.id}
            entitlements={billing.entitlements}
            billingExempt={billing.billingExempt}
          />
        </section>
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminWorkspaceDetailPage);
