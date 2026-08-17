import type { MetaRecord } from 'nextra';

import { WorkspaceSidebarHeader } from '../../components/workspace-sidebar-header';

const meta: MetaRecord = {
  '--workspace': {
    type: 'separator',
    title: <WorkspaceSidebarHeader />,
  },
  index: 'Introduction',
  'getting-started': 'Getting started',
  workspace: 'Workspace',
  disposals: 'Disposals',
  'wip-pipeline': 'WIP pipeline',
  requirements: 'Requirements',
  circulation: 'Circulation',
  contacts: 'Contacts',
  viewings: 'Viewings',
  'proposals-sales': 'HoTs, proposals & sales',
  'publishing-portals': 'Website & portals',
  'seats-billing': 'Seats & billing',
  'security-trust': 'Security & trust',
};

export default meta;
