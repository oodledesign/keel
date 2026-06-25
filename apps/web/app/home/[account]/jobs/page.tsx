import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface LegacyJobsRedirectProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyJobsRedirect({
  params,
  searchParams,
}: LegacyJobsRedirectProps) {
  const { account } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') qs.set(key, value);
  }
  const base = pathsConfig.app.accountProjects.replace('[account]', account);
  redirect(qs.size > 0 ? `${base}?${qs.toString()}` : base);
}
