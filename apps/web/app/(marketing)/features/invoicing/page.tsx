import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('invoicing');

export default function InvoicingFeaturePage() {
  return <FeaturePageView slug="invoicing" />;
}
