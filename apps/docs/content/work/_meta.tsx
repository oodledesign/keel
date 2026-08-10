import type { MetaRecord } from 'nextra';

import { WorkspaceSidebarHeader } from '../../components/workspace-sidebar-header';

const meta: MetaRecord = {
  '--workspace': {
    type: 'separator',
    title: <WorkspaceSidebarHeader />,
  },
  index: 'Overview',
  'getting-started': 'Getting started',
  workspace: 'Workspace',
  'clients-pipeline': 'Clients & pipeline',
  'projects-tasks': 'Projects & tasks',
  'invoicing-billing': 'Invoicing & billing',
  'activity-meetings': 'Activity & meetings',
  'email-assistant': 'Email assistant',
  'portals-websites': 'Portals & websites',
  'security-trust': 'Security & trust',
};

export default meta;
