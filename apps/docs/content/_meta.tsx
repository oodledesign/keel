import type { MetaRecord } from 'nextra';

import { WorkspaceSidebarHeader } from '../../components/workspace-sidebar-header';

/**
 * Root meta: introduction + workspace picker.
 * Workspace trees are filtered via getPageMap in the layout — hide them here
 * so they do not appear as sibling nav groups on the homepage.
 */
const meta: MetaRecord = {
  '--workspace': {
    type: 'separator',
    title: <WorkspaceSidebarHeader />,
  },
  index: 'Introduction',
  personal: {
    type: 'page',
    display: 'hidden',
    title: 'Personal',
  },
  work: {
    type: 'page',
    display: 'hidden',
    title: 'Business',
  },
  'commercial-property': {
    type: 'page',
    display: 'hidden',
    title: 'Commercial property',
  },
};

export default meta;
