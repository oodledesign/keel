import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('finances');

export default function FinancesFeaturePage() {
  return <FeaturePageView slug="finances" />;
}
