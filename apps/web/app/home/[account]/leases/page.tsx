import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface PageProps {
  params: Promise<{ account: string }>;
}

/** Legacy `/leases` slug → `/sales-and-lettings`. */
export default async function LeasesRedirectPage({ params }: PageProps) {
  const { account } = await params;
  redirect(pathsConfig.app.accountLeases.replace('[account]', account));
}
