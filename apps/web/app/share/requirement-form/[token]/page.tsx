import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadPublicRequirementFormByToken } from '~/lib/commercial/circulation/public-requirement-form';

import { PublicRequirementFormClient } from './_components/public-requirement-form-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicRequirementFormPage({ params }: PageProps) {
  const { token } = await params;
  const admin = getSupabaseServerAdminClient();
  const form = await loadPublicRequirementFormByToken(admin, token);
  if (!form) notFound();

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50,#FBF6EC)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
        <PublicRequirementFormClient
          token={form.token}
          agencyName={form.accountName}
          title={form.title}
          intro={form.intro}
          privacyPolicyUrl={form.privacyPolicyUrl}
          successMessage={form.successMessage}
        />
      </div>
    </main>
  );
}
