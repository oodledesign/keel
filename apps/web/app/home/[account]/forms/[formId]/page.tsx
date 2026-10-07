import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { resolveBrandLogoForSurface } from '~/lib/brand/resolve-brand-logo';
import { withI18n } from '~/lib/i18n/with-i18n';
import { parseFormEditorTab } from '~/lib/workspace-forms/form-editor-tab';
import {
  canAccessWorkspaceForms,
  resolveWorkspaceFormsMode,
} from '~/lib/workspace-forms/forms-mode';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { isCampaignsModuleEnabled } from '../../_lib/server/account-modules';
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
    !canAccessWorkspaceForms(workspace.moduleSettings)
  ) {
    redirect(getDefaultAccountPath(accountSlug));
  }

  const formsMode = resolveWorkspaceFormsMode(workspace.moduleSettings);

  const {
    form,
    submissions,
    listings,
    members,
    audienceLists,
    brand,
    contactFields,
  } = await loadWorkspaceFormDetail(workspace.account.id, formId, accountSlug);

  if (!form) {
    notFound();
  }

  if (
    form.destination === 'mailing_list' &&
    isCampaignsModuleEnabled(workspace.moduleSettings)
  ) {
    const tab = query.tab ? `?tab=${encodeURIComponent(query.tab)}` : '';
    redirect(
      `${pathsConfig.app.accountEmailCampaignFormDetail
        .replace('[account]', accountSlug)
        .replace('[formId]', formId)}${tab}`,
    );
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
          audienceLists={audienceLists}
          contactFields={contactFields}
          submissions={submissions}
          members={members}
          showListingDestination={isCommercialPropertyProfile(
            workspace.workspaceProfile,
          )}
          formsMode={formsMode}
          brandColors={{
            primary: brand.primary_color,
            accent: brand.accent_color,
          }}
          accountName={workspace.account.name ?? ''}
          brandSecondaryColor={brand.secondary_color}
          brandLogoUrl={resolveBrandLogoForSurface(brand, 'light')}
          initialTab={parseFormEditorTab(query.tab)}
        />
      </PageBody>
    </>
  );
}

export default withI18n(FormDetailPage);
