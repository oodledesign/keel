import type { MetaRecord } from 'nextra';

/**
 * Root meta: introduction only in the sidebar.
 * Workspace trees are routed under /personal, /work, /commercial-property
 * and filtered via getPageMap in the layout — hide them here so they do not
 * appear as sibling nav groups on the homepage.
 */
const meta: MetaRecord = {
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
