import { loadPublicBrochureByToken } from '~/lib/commercial/public-brochure.loader';
import { withI18n } from '~/lib/i18n/with-i18n';

import { BrochureSlideshow } from './_components/brochure-slideshow';

interface BrochureSharePageProps {
  params: Promise<{ token: string }>;
}

export const generateMetadata = async ({ params }: BrochureSharePageProps) => {
  const { token } = await params;
  const data = await loadPublicBrochureByToken(token);
  return {
    title: data ? `${data.listing.name} · Brochure` : 'Brochure not found',
    description: data?.listing.summary?.slice(0, 160) ?? undefined,
    robots: { index: false, follow: false },
  };
};

async function BrochureSharePage({ params }: BrochureSharePageProps) {
  const { token } = await params;
  const data = await loadPublicBrochureByToken(token);

  if (!data) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--ozer-plum-900)] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-[var(--ozer-text-on-dark)]">
            Brochure not found
          </h1>
          <p className="mt-2 text-sm text-[var(--ozer-text-on-dark-muted)]">
            This share link is invalid or has been disabled.
          </p>
        </div>
      </main>
    );
  }

  return <BrochureSlideshow data={data} />;
}

export default withI18n(BrochureSharePage);
