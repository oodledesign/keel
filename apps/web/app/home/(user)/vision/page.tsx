import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPersonalVisionDeck } from '~/lib/personal-vision/personal-vision.loader';

import { VisionSlideshow } from './_components/vision-slideshow';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:visionPlayerTitle', {
      defaultValue: 'Personal Vision',
    }),
  };
};

async function PersonalVisionPlayerPage() {
  const deck = await loadPersonalVisionDeck();

  return <VisionSlideshow slides={deck.hasContent ? deck.slides : []} />;
}

export default withI18n(PersonalVisionPlayerPage);
