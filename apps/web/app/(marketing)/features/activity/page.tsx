import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('activity');

export default function ActivityFeaturePage() {
  return <FeaturePageView slug="activity" />;
}
