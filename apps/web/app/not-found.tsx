import { ErrorPageContent } from '~/components/error-page-content';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('common:notFound');

  return {
    title,
  };
};

const NotFoundPage = async () => {
  return (
    <div className={'flex h-screen flex-1 flex-col'}>
      <ErrorPageContent
        statusCode={'common:pageNotFoundHeading'}
        heading={'common:pageNotFound'}
        subtitle={'common:pageNotFoundSubHeading'}
      />
    </div>
  );
};

export default withI18n(NotFoundPage);
