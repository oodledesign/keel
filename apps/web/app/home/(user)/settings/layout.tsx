import { Suspense } from 'react';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { PersonalIntegrationsToasts } from './_components/personal-integrations-toasts';
import { PersonalSettingsSidebar } from './_components/personal-settings-sidebar';
import { buildPersonalSettingsNav } from './_lib/personal-settings-nav';

function UserSettingsLayout(props: React.PropsWithChildren) {
  const navItems = buildPersonalSettingsNav();

  return (
    <>
      <HomeLayoutPageHeader
        title={<Trans i18nKey={'account:routes.settings'} />}
        description={<AppBreadcrumbs />}
      />

      <Suspense fallback={null}>
        <PersonalIntegrationsToasts />
      </Suspense>

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 lg:flex-row lg:items-start lg:gap-10 lg:px-0">
          <PersonalSettingsSidebar items={navItems} />
          <div className="min-w-0 flex-1">{props.children}</div>
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(UserSettingsLayout);
