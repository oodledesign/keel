import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('planner');

export default function PlannerFeaturePage() {
  return <FeaturePageView slug="planner" />;
}
