import { notFound } from 'next/navigation';

import { loadPublicSupportOrgByToken } from '~/lib/support/public-support.service';

import { PublicSupportSubmitForm } from './_components/public-support-submit-form';

export const metadata = {
  title: 'Submit support request',
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicSupportSubmitPage({ params }: PageProps) {
  const { token } = await params;
  const org = await loadPublicSupportOrgByToken(token);

  if (!org) {
    notFound();
  }

  return (
    <main className="min-h-svh bg-zinc-50 px-4 py-12 text-zinc-900">
      <PublicSupportSubmitForm
        token={token}
        workspaceName={org.accountName}
        workspaceLogoUrl={org.accountLogoUrl}
        clientName={org.clientOrgName}
        clientPictureUrl={org.clientPictureUrl}
        contacts={org.contacts}
        projects={org.projects}
      />
    </main>
  );
}
