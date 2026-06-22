import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () => buildFeaturePageMetadata('tasks');

export default function TasksFeaturePage() {
  return <FeaturePageView slug="tasks" />;
}
