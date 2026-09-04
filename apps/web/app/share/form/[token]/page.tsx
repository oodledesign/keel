import { withI18n } from '~/lib/i18n/with-i18n';
import { loadCachedPublicWorkspaceForm } from '~/lib/workspace-forms/public-form';

import { PublicWorkspaceForm } from './_components/public-workspace-form';

export const dynamic = 'force-dynamic';

interface PublicFormPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    listing?: string;
    property?: string;
    embed?: string;
    email?: string;
  }>;
}

export const generateMetadata = async ({ params }: PublicFormPageProps) => {
  const { token } = await params;
  const form = await loadCachedPublicWorkspaceForm(token);
  return {
    title: form ? `${form.name} · ${form.accountName}` : 'Form not found',
    robots: { index: false, follow: false },
  };
};

async function PublicWorkspaceFormPage({
  params,
  searchParams,
}: PublicFormPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const form = await loadCachedPublicWorkspaceForm(token);
  const embed = query.embed === '1' || query.embed === 'true';

  if (!form) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--ozer-cream-50,#FBF6EC)] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-[var(--ozer-plum-900)]">
            Form not found
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            This share link is invalid or has been disabled.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-[100dvh] px-4 ${embed ? 'py-4' : 'py-10 sm:px-6'}`}
      style={{ background: form.brand.secondary_color || '#FBF6EC' }}
    >
      <PublicWorkspaceForm
        token={token}
        accountName={form.accountName}
        formName={form.name}
        description={form.description}
        submitLabel={form.submitLabel}
        successMessage={form.successMessage}
        fields={form.fields}
        listingId={query.listing ?? form.listingId}
        propertyId={query.property ?? null}
        embed={embed}
        prefillEmail={query.email ?? null}
        logoUrl={form.brand.logo_url}
        accentColor={form.brand.accent_color}
        primaryColor={form.brand.primary_color}
      />
    </main>
  );
}

export default withI18n(PublicWorkspaceFormPage);
