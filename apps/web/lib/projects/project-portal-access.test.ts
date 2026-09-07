import { describe, expect, it } from 'vitest';

import {
  type ProjectPortalAccess,
  summarizeProjectPortalAccess,
} from '~/home/[account]/projects/_lib/schema/project-portal-access.schema';

function access(
  overrides: Partial<ProjectPortalAccess> = {},
): ProjectPortalAccess {
  return {
    jobId: '00000000-0000-0000-0000-000000000001',
    clientId: '00000000-0000-0000-0000-000000000002',
    portalVisible: true,
    restrictContacts: false,
    contactIds: [],
    contacts: [],
    ...overrides,
  };
}

describe('summarizeProjectPortalAccess', () => {
  it('describes hidden projects', () => {
    expect(summarizeProjectPortalAccess(access({ portalVisible: false }))).toBe(
      'Not shared with portal',
    );
    expect(summarizeProjectPortalAccess(null)).toBe('Not shared with portal');
  });

  it('describes the default all-contacts mode', () => {
    expect(summarizeProjectPortalAccess(access())).toBe(
      'Shared with all portal contacts',
    );
  });

  it('describes a restricted allowlist', () => {
    expect(
      summarizeProjectPortalAccess(
        access({ restrictContacts: true, contactIds: ['a', 'b'] }),
      ),
    ).toBe('Shared with 2 contacts');
    expect(
      summarizeProjectPortalAccess(
        access({ restrictContacts: true, contactIds: ['a'] }),
      ),
    ).toBe('Shared with 1 contact');
    expect(
      summarizeProjectPortalAccess(
        access({ restrictContacts: true, contactIds: [] }),
      ),
    ).toBe('Shared — no contacts selected');
  });
});
