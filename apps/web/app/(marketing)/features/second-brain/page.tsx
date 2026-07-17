import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('second-brain');

export default function SecondBrainFeaturePage() {
  return <FeaturePageView slug="second-brain" />;
}
