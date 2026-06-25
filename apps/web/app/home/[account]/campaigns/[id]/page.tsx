import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface LegacyCampaignDetailRedirectProps {
  params: Promise<{ account: string; id: string }>;
}

export default async function LegacyCampaignDetailRedirect({
  params,
}: LegacyCampaignDetailRedirectProps) {
  const { account, id } = await params;
  redirect(
    pathsConfig.app.accountProjects.replace('[account]', account) + `/${id}`,
  );
}
