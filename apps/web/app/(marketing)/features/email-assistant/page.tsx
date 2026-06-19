import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () =>
  buildFeaturePageMetadata('email-assistant');

export default function EmailAssistantFeaturePage() {
  return <FeaturePageView slug="email-assistant" />;
}
