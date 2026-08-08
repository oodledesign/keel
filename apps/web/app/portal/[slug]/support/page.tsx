import { redirect } from 'next/navigation';

interface LegacySupportRedirectProps {
  params: Promise<{ slug: string }>;
}

/** Legacy /support → /services (also covered by next.config redirects). */
export default async function LegacyPortalSupportRedirect({
  params,
}: LegacySupportRedirectProps) {
  const { slug } = await params;
  redirect(`/portal/${slug}/services`);
}
