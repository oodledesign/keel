import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

type VideoSettingsPageProps = {
  params: Promise<{ account: string }>;
};

/** Bunny credentials are platform-managed; this settings page is retired. */
export default async function VideoSettingsPage({
  params,
}: VideoSettingsPageProps) {
  const { account } = await params;
  redirect(pathsConfig.app.accountVideos.replace('[account]', account));
}
