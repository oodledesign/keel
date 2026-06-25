import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface LegacyJobDetailRedirectProps {
  params: Promise<{ account: string; id: string }>;
}

export default async function LegacyJobDetailRedirect({
  params,
}: LegacyJobDetailRedirectProps) {
  const { account, id } = await params;
  redirect(
    pathsConfig.app.accountProjects.replace('[account]', account) + `/${id}`,
  );
}
