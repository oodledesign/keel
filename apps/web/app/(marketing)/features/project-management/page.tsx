import { buildFeaturePageMetadata } from '~/lib/marketing/feature-landing-pages';

import { FeaturePageView } from '../../_components/feature-page-view';

export const generateMetadata = () =>
  buildFeaturePageMetadata('project-management');

export default function ProjectManagementFeaturePage() {
  return <FeaturePageView slug="project-management" />;
}
