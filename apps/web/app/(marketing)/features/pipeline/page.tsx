import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('pipeline');

export default function PipelineFeaturePage() {
  return <FeaturePageView slug="pipeline" />;
}
