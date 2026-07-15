import { notFound } from 'next/navigation';

import { loadPublicSignaturePreview } from '~/lib/signatures/preview-share';

import { SignatureEmailMockup } from './_components/signature-email-mockup';

type PageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const preview = await loadPublicSignaturePreview(token);

  if (!preview) {
    return { title: 'Signature preview' };
  }

  return {
    title: preview.isPersonalShare
      ? `${preview.fromName} · Install signature`
      : `${preview.templateName} · Signature preview`,
    description: 'Preview and install an Ozer email signature.',
    robots: { index: false, follow: false },
  };
}

export default async function SignaturePublicPreviewPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const preview = await loadPublicSignaturePreview(token);
  if (!preview) {
    notFound();
  }

  return (
    <SignatureEmailMockup
      templateName={preview.templateName}
      accountName={preview.accountName}
      fromName={preview.fromName}
      fromEmail={preview.fromEmail}
      signatureHtml={preview.signatureHtml}
      isPersonalShare={preview.isPersonalShare}
    />
  );
}
