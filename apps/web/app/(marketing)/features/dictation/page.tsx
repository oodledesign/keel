import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('dictation');

export default function DictationFeaturePage() {
  return <FeaturePageView slug="dictation" />;
}
