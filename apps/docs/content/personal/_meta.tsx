import type { MetaRecord } from 'nextra';

import { WorkspaceSidebarHeader } from '../../components/workspace-sidebar-header';

const meta: MetaRecord = {
  '--workspace': {
    type: 'separator',
    title: <WorkspaceSidebarHeader />,
  },
  index: 'Introduction',
  'getting-started': 'Getting started',
  'home-hub': 'Home hub',
  'tasks-planner': 'Tasks & planner',
  'projects-notes': 'Projects & notes',
  people: 'People',
  email: 'Personal email',
  'security-trust': 'Security & trust',
};

export default meta;
