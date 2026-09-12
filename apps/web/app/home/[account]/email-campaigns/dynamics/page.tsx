import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface LegacyDynamicsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Dynamics 365',
});

/** Client-side / RSC navigations skip next.config redirects; keep this page. */
export default async function LegacyCampaignsDynamicsRedirect({
  params,
}: LegacyDynamicsPageProps) {
  const accountSlug = (await params).account;
  redirect(
    pathsConfig.app.accountIntegrationsDynamicsSettings.replace(
      '[account]',
      accountSlug,
    ),
  );
}
