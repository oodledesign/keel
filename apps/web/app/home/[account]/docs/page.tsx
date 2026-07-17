import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

interface DocsRedirectPageProps {
  params: Promise<{ account: string }>;
}

/** Legacy docs route — unified under Notes and files. */
export default async function DocsRedirectPage({
  params,
}: DocsRedirectPageProps) {
  const { account } = await params;
  redirect(pathsConfig.app.accountNotes.replace('[account]', account));
}
