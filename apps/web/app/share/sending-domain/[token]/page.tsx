import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPublicSendingDomainInstructions } from '~/lib/sending-domains/server';

import { PublicSendingDomainInstructionsView } from './_components/public-sending-domain-instructions';

export const dynamic = 'force-dynamic';

interface PublicSendingDomainPageProps {
  params: Promise<{ token: string }>;
}

export const generateMetadata = async ({
  params,
}: PublicSendingDomainPageProps) => {
  const { token } = await params;
  const admin = getSupabaseServerAdminClient();
  const instructions = await loadPublicSendingDomainInstructions(admin, token);

  return {
    title: instructions
      ? `DNS setup · ${instructions.sendingHost}`
      : 'DNS instructions not found',
    robots: { index: false, follow: false },
  };
};

async function PublicSendingDomainPage({
  params,
}: PublicSendingDomainPageProps) {
  const { token } = await params;
  const admin = getSupabaseServerAdminClient();
  const instructions = await loadPublicSendingDomainInstructions(admin, token);

  if (!instructions) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--ozer-cream-50,#FBF6EC)] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-[var(--ozer-plum-900,#2B1B33)]">
            Instructions not found
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            This share link is invalid or has been removed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--ozer-cream-50,#FBF6EC)] px-4 py-10 sm:px-6">
      <PublicSendingDomainInstructionsView instructions={instructions} />
    </main>
  );
}

export default withI18n(PublicSendingDomainPage);
