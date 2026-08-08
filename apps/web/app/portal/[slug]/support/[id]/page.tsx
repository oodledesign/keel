import { redirect } from 'next/navigation';

interface LegacySupportDetailRedirectProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function LegacyPortalSupportDetailRedirect({
  params,
}: LegacySupportDetailRedirectProps) {
  const { slug, id } = await params;
  redirect(`/portal/${slug}/services/${id}`);
}
