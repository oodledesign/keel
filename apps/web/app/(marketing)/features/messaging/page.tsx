import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('messaging');

export default function MessagingFeaturePage() {
  return <FeaturePageView slug="messaging" />;
}
