import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('freeagent');

export default function FreeAgentFeaturePage() {
  return <FeaturePageView slug="freeagent" />;
}
