import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

type SignaturesSettingsPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ connected?: string; tab?: string }>;
};

export default async function SignaturesSettingsPage({
  params,
  searchParams,
}: SignaturesSettingsPageProps) {
  const { account } = await params;
  const sp = await searchParams;

  if (sp.tab === 'integrations' || sp.connected === 'true') {
    const target = pathsConfig.app.accountSignaturesIntegrations.replace(
      '[account]',
      account,
    );
    redirect(sp.connected === 'true' ? `${target}?connected=true` : target);
  }

  redirect(
    pathsConfig.app.accountSignaturesCustomData.replace('[account]', account),
  );
}
