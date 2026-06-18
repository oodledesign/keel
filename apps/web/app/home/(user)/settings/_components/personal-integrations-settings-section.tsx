import 'server-only';

import { loadPersonalIntegrationsData } from '../_lib/server/personal-integrations.loader';
import { PersonalIntegrationsSection } from './personal-integrations-section';

export async function PersonalIntegrationsSettingsSection() {
  const data = await loadPersonalIntegrationsData();
  return <PersonalIntegrationsSection data={data} />;
}
