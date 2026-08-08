import { redirect } from 'next/navigation';

interface LegacySupportNewRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyPortalSupportNewRedirect({
  params,
}: LegacySupportNewRedirectProps) {
  const { slug } = await params;
  redirect(`/portal/${slug}/services/new`);
}
