import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface WorkspacePlannerIndexPageProps {
  params: Promise<{ account: string }>;
}

export default async function WorkspacePlannerIndexPage({
  params,
}: WorkspacePlannerIndexPageProps) {
  const accountSlug = (await params).account;

  redirect(pathsConfig.app.accountPlanner.replace('[account]', accountSlug));
}
