import { describe, expect, it } from 'vitest';

import { resolveNoteAssignmentLabels } from '~/home/[account]/_lib/workspace-content/context-resolve';

describe('resolveNoteAssignmentLabels', () => {
  it('returns client and project names when both are linked', () => {
    expect(
      resolveNoteAssignmentLabels({
        client_id: 'client-1',
        project_id: 'project-1',
        clients: { display_name: 'Acme Ltd' },
        projects: { name: 'Website redesign', title: null },
      }),
    ).toEqual({
      clientName: 'Acme Ltd',
      projectName: 'Website redesign',
    });
  });

  it('prefers project title over name', () => {
    expect(
      resolveNoteAssignmentLabels({
        project_id: 'project-1',
        projects: { name: 'delivery', title: 'Brand refresh' },
      }),
    ).toEqual({
      clientName: null,
      projectName: 'Brand refresh',
    });
  });

  it('uses client org name when present', () => {
    expect(
      resolveNoteAssignmentLabels({
        client_org_id: 'org-1',
        client_orgs: { name: 'Northwind' },
      }),
    ).toEqual({
      clientName: 'Northwind',
      projectName: null,
    });
  });
});
