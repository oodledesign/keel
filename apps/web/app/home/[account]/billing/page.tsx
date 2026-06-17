import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface TeamAccountBillingPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ addon?: string; setup?: string; upgrade?: string }>;
}

/** Legacy route — billing lives under workspace settings. */
export default async function TeamAccountBillingPage({
  params,
  searchParams,
}: TeamAccountBillingPageProps) {
  const account = (await params).account;
  const query = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      qs.set(key, value);
    }
  }

  const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
  const target = pathsConfig.app.accountBilling
    .replace('[account]', account)
    .concat(suffix);

  redirect(target);
}
