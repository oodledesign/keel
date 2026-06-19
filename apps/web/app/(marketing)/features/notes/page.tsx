import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('notes');

export default function NotesFeaturePage() {
  return <FeaturePageView slug="notes" />;
}
