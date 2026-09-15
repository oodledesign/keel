import { loadPublicSurveyPhotosByToken } from '~/lib/building-surveyor/public-survey-photos.loader';
import { buildingSurveySectionByKey } from '~/lib/building-surveyor/report-sections';
import { withI18n } from '~/lib/i18n/with-i18n';

interface SurveyPhotoSharePageProps {
  params: Promise<{ token: string }>;
}

export const generateMetadata = async ({
  params,
}: SurveyPhotoSharePageProps) => {
  const { token } = await params;
  const data = await loadPublicSurveyPhotosByToken(token);
  return {
    title: data ? `${data.title} · Photos` : 'Survey photos',
    robots: { index: false, follow: false },
  };
};

async function SurveyPhotoSharePage({ params }: SurveyPhotoSharePageProps) {
  const { token } = await params;
  const data = await loadPublicSurveyPhotosByToken(token);

  if (!data) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--ozer-plum-900)] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-[var(--ozer-text-on-dark)]">
            Photographs not found
          </h1>
          <p className="mt-2 text-sm text-[var(--ozer-text-on-dark-muted)]">
            This share link is invalid or has been turned off.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--ozer-cream-50)] px-4 py-8 text-[var(--ozer-plum-900)]">
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-xs tracking-wide text-[var(--ozer-text-muted)] uppercase">
          {data.firmName}
        </p>
        <h1 className="font-heading mt-1 text-2xl font-bold">{data.title}</h1>
        <p className="mt-2 text-sm text-[var(--ozer-text-muted)]">
          Full photo set for {data.propertyLabel}. These images are for the
          record — they are not the curated report illustrations.
        </p>

        {data.photos.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--ozer-text-muted)]">
            No photographs have been uploaded to this survey yet.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.photos.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl border border-[color:var(--ozer-border-on-light)] bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || photo.title}
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="p-3">
                  <p className="text-sm font-medium">{photo.title}</p>
                  {photo.caption ? (
                    <p className="mt-1 text-xs text-[var(--ozer-text-muted)]">
                      {photo.caption}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[10px] tracking-wide text-[var(--ozer-text-muted)] uppercase">
                    {photo.photoRole === 'curated'
                      ? (buildingSurveySectionByKey(photo.sectionKey ?? '')
                          ?.heading ?? 'Curated')
                      : 'Archive'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default withI18n(SurveyPhotoSharePage);
