import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { isSignaturesModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { SignaturesConnectionGate } from '../_components/signatures-connection-gate';
import { SignaturesModuleDisabled } from '../_components/signatures-module-disabled';
import { SignaturesPostgrestSchemaMissing } from '../_components/signatures-postgrest-schema-missing';
import { SignaturesNav } from '../_components/signatures-nav';
import { isSignaturesPostgrestSchemaError } from '../_lib/signatures-postgrest-schema-error';
import { isSignaturesUxPreviewEnabled } from '~/lib/signatures/ux-preview';

import { redirectIfAddonNotAllowed } from '~/lib/billing/require-addon-access';

import { getSignaturesMailProvider, isSignaturesMailConnected } from '~/lib/signatures/signatures-provider';

type SignaturesLayoutProps = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

export default async function SignaturesLayout({
  children,
  params,
}: SignaturesLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  await redirectIfAddonNotAllowed(
    account,
    workspace.account.id as string,
    'addon_signatures',
  );

  if (!isSignaturesModuleEnabled(workspace.moduleSettings)) {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={<Trans i18nKey="signatures:title" />}
          description={<Trans i18nKey="signatures:description" />}
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
          <SignaturesModuleDisabled accountSlug={account} />
        </PageBody>
      </>
    );
  }

  const accountId = workspace.account.id as string;
  const uxPreview = isSignaturesUxPreviewEnabled();
  let hasRealConnection = false;
  let mailProvider: Awaited<ReturnType<typeof getSignaturesMailProvider>> = null;

  try {
    hasRealConnection = await isSignaturesMailConnected(accountId);
    if (hasRealConnection) {
      mailProvider = await getSignaturesMailProvider(accountId);
    }
  } catch (err) {
    if (isSignaturesPostgrestSchemaError(err)) {
      const i18n = await createI18nServerInstance();
      const t = i18n.getFixedT(null, 'signatures');

      return (
        <>
          <TeamAccountLayoutPageHeader
            account={account}
            title={t('title')}
            description={t('description')}
          />
          <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
            <SignaturesPostgrestSchemaMissing />
          </PageBody>
        </>
      );
    }
    throw err;
  }

  const connected = hasRealConnection || uxPreview;
  const connectionDescription =
    hasRealConnection && mailProvider
      ? `Connected via ${
          mailProvider === 'google' ? 'Google Workspace' : 'Microsoft 365'
        }.`
      : undefined;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={<Trans i18nKey="signatures:title" />}
        description={
          connectionDescription ?? <Trans i18nKey="signatures:description" />
        }
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <SignaturesNav
          accountSlug={account}
          accountId={accountId}
          showActions={connected}
          mailProvider={mailProvider}
          mailActionsDisabled={uxPreview && !hasRealConnection}
        />
        <SignaturesConnectionGate
          accountId={accountId}
          accountSlug={account}
          connected={connected}
          showUxPreviewBanner={uxPreview && !hasRealConnection}
        >
          {children}
        </SignaturesConnectionGate>
      </PageBody>
    </>
  );
}
