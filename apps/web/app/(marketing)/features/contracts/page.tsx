import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('contracts');

export default function ContractsFeaturePage() {
  return <FeaturePageView slug="contracts" />;
}
