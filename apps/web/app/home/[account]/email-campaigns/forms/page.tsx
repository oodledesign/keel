import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { resolveWorkspaceFormsMode } from '~/lib/workspace-forms/forms-mode';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { isCommercialPropertyProfile } from '../../_lib/workspace-profile';
import { FormsList } from '../../forms/_components/forms-list';
import { loadWorkspaceFormsPage } from '../../forms/_lib/server/forms.loader';
import { CampaignsHubNav } from '../_components/campaigns-hub-nav';

interface SignupFormsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Sign-up forms' });

async function SignupFormsPage({ params }: SignupFormsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const { forms } = await loadWorkspaceFormsPage(workspace.account.id);
  const signupForms = forms.filter(
    (form) => form.destination === 'mailing_list',
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Sign-up forms"
        description="Subscribe forms that feed your audiences. Share a link or embed one on your website."
      />
      <PageBody className="space-y-2 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        <FormsList
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          forms={signupForms}
          showListingDestination={isCommercialPropertyProfile(
            workspace.workspaceProfile,
          )}
          formsMode={resolveWorkspaceFormsMode(workspace.moduleSettings)}
          scope="mailing_list"
        />
      </PageBody>
    </>
  );
}

export default withI18n(SignupFormsPage);
