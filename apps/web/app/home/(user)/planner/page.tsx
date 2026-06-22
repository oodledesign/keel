import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

export default function PersonalPlannerIndexPage() {
  redirect(pathsConfig.app.personalPlanner);
}
