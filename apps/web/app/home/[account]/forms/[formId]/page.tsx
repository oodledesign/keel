import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { parseFormEditorTab } from '~/lib/workspace-forms/form-editor-tab';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  FORMS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { isCommercialPropertyProfile } from '../../_lib/workspace-profile';
import { FormBuilder } from '../_components/form-builder';
import { loadWorkspaceFormDetail } from '../_lib/server/forms.loader';

interface FormDetailPageProps {
  params: Promise<{ account: string; formId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const generateMetadata = async () => ({
  title: 'Edit form',
});

async function FormDetailPage({ params, searchParams }: FormDetailPageProps) {
  const { account: accountSlug, formId } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, FORMS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'forms')
  ) {
    redirect(getDefaultAccountPath(accountSlug));
  }

  const { form, submissions, listings, members } =
    await loadWorkspaceFormDetail(workspace.account.id, formId, accountSlug);

  if (!form) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={form.name}
        description="Submissions, questions, settings, notifications, and share links."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
        <FormBuilder
          accountSlug={accountSlug}
          form={form}
          listings={listings}
          submissions={submissions}
          members={members}
          showListingDestination={isCommercialPropertyProfile(
            workspace.workspaceProfile,
          )}
          initialTab={parseFormEditorTab(query.tab)}
        />
      </PageBody>
    </>
  );
}

export default withI18n(FormDetailPage);
