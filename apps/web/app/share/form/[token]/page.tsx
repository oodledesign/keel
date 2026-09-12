import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  brandLogoSurfaceForPage,
  resolveBrandLogoForSurface,
} from '~/lib/brand/resolve-brand-logo';
import { withI18n } from '~/lib/i18n/with-i18n';
import { isLikelyResumeToken } from '~/lib/workspace-forms/form-draft';
import {
  loadPublicFormDraft,
  publicFormStepCount,
} from '~/lib/workspace-forms/form-draft.server';
import { shouldIncludeWelcomeStep } from '~/lib/workspace-forms/form-steps';
import { brandPageGradientCss } from '~/lib/workspace-forms/form-theme';
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
    resume?: string;
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

  const brandGradient = form.theme.pageBackground === 'brand_gradient';
  const pageBackground = brandGradient
    ? brandPageGradientCss(form.brand.primary_color)
    : form.brand.secondary_color || '#FBF6EC';
  const useContentShell = !embed;
  const logoSurface = brandLogoSurfaceForPage({
    pageOnDark: brandGradient,
    logoOnLightShell: useContentShell,
  });

  const includeWelcome = shouldIncludeWelcomeStep({
    presentation: form.theme.presentation,
    layout: form.theme.layout,
    embed,
    hasIntro: Boolean(
      form.description?.trim() ||
      form.eventAddress?.trim() ||
      form.eventDate?.trim() ||
      form.eventTime?.trim(),
    ),
  });
  const draft =
    isLikelyResumeToken(query.resume) && form.id
      ? await loadPublicFormDraft(getSupabaseServerAdminClient(), {
          formId: form.id,
          resumeToken: query.resume,
          fields: form.fields,
          stepCount: publicFormStepCount(form, { includeWelcome }),
        })
      : null;

  return (
    <main
      className={`flex min-h-[100dvh] flex-col px-4 ${embed ? 'py-4' : 'py-10 sm:px-6'}`}
      style={{ background: pageBackground }}
    >
      <PublicWorkspaceForm
        token={token}
        accountName={form.accountName}
        formName={form.name}
        description={form.description}
        eventAddress={form.eventAddress}
        eventDate={form.eventDate}
        eventTime={form.eventTime}
        layout={form.theme.layout}
        presentation={form.theme.presentation}
        submitLabel={form.submitLabel}
        successMessage={form.successMessage}
        fields={form.fields}
        listingId={query.listing ?? form.listingId}
        propertyId={query.property ?? null}
        embed={embed}
        prefillEmail={query.email ?? null}
        resumeToken={draft?.resumeToken ?? null}
        initialValues={draft?.values}
        initialStepIndex={draft?.stepIndex}
        logoUrl={resolveBrandLogoForSurface(form.brand, logoSurface)}
        accentColor={form.brand.accent_color}
        primaryColor={form.brand.primary_color}
        chromeOnDark={brandGradient && !useContentShell}
        contentShell={useContentShell}
      />
    </main>
  );
}

export default withI18n(PublicWorkspaceFormPage);
