import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { resolveBrandLogoForSurface } from '~/lib/brand/resolve-brand-logo';
import { withI18n } from '~/lib/i18n/with-i18n';
import { parseFormEditorTab } from '~/lib/workspace-forms/form-editor-tab';
import { resolveWorkspaceFormsMode } from '~/lib/workspace-forms/forms-mode';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { isCommercialPropertyProfile } from '../../../_lib/workspace-profile';
import { FormBuilder } from '../../../forms/_components/form-builder';
import { loadWorkspaceFormDetail } from '../../../forms/_lib/server/forms.loader';
import { CampaignsHubNav } from '../../_components/campaigns-hub-nav';

interface SignupFormDetailPageProps {
  params: Promise<{ account: string; formId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const generateMetadata = async () => ({ title: 'Edit sign-up form' });

async function SignupFormDetailPage({
  params,
  searchParams,
}: SignupFormDetailPageProps) {
  const { account: accountSlug, formId } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);

  const {
    form,
    submissions,
    listings,
    members,
    audienceLists,
    brand,
    contactFields,
  } = await loadWorkspaceFormDetail(workspace.account.id, formId, accountSlug);

  if (!form || form.destination !== 'mailing_list') {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title={form.name}
        description="Questions, design, audience, notifications and share links for this sign-up form."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
        <div className="px-4 pt-6 lg:px-8">
          <CampaignsHubNav accountSlug={accountSlug} />
        </div>
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
          formsMode={resolveWorkspaceFormsMode(workspace.moduleSettings)}
          brandColors={{
            primary: brand.primary_color,
            accent: brand.accent_color,
          }}
          accountName={workspace.account.name ?? ''}
          brandSecondaryColor={brand.secondary_color}
          brandLogoUrl={resolveBrandLogoForSurface(brand, 'light')}
          listPath={pathsConfig.app.accountEmailCampaignForms.replace(
            '[account]',
            accountSlug,
          )}
          initialTab={parseFormEditorTab(query.tab)}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SignupFormDetailPage);
