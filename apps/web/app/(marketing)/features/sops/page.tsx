import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('sops');

export default function SopsFeaturePage() {
  return <FeaturePageView slug="sops" />;
}
