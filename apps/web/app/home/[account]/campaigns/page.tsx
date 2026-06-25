import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface LegacyCampaignsRedirectProps {
  params: Promise<{ account: string }>;
}

export default async function LegacyCampaignsRedirect({
  params,
}: LegacyCampaignsRedirectProps) {
  const { account } = await params;
  redirect(
    `${pathsConfig.app.accountProjects.replace('[account]', account)}?type=campaign`,
  );
}
