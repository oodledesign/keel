import { notFound } from 'next/navigation';

import { loadPublicSignaturePreview } from '~/lib/signatures/preview-share';

import { SignatureEmailMockup } from './_components/signature-email-mockup';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

function resolveViewParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'preview' ? 'preview' : 'install';
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const view = resolveViewParam(resolvedSearchParams.view);
  const preview = await loadPublicSignaturePreview(token);

  if (!preview) {
    return { title: 'Signature preview' };
  }

  if (view === 'preview') {
    return {
      title: preview.isPersonalShare
        ? `${preview.fromName} · Signature preview`
        : `${preview.templateName} · Signature preview`,
      description: 'Preview an Ozer email signature in a mock email.',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: preview.isPersonalShare
      ? `${preview.fromName} · Install signature`
      : `${preview.templateName} · Signature preview`,
    description: 'Preview and install an Ozer email signature.',
    robots: { index: false, follow: false },
  };
}

export default async function SignaturePublicPreviewPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const view = resolveViewParam(resolvedSearchParams.view);
  const showInstructions = view !== 'preview';

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
      token={token}
      showInstructions={showInstructions}
    />
  );
}
