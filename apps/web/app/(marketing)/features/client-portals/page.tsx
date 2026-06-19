import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () =>
  buildFeaturePageMetadata('client-portals');

export default function ClientPortalsFeaturePage() {
  return <FeaturePageView slug="client-portals" />;
}
