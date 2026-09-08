import { describe, expect, it } from 'vitest';

import { formatWhoCanSee, inferComposeType } from './compose-thread';

describe('inferComposeType', () => {
  it('uses a project as a job-linked thread', () => {
    expect(
      inferComposeType({
        people: [{ kind: 'member', id: '1', name: 'Lucy' }],
        entity: { kind: 'project', id: 'p1', name: 'Brand refresh' },
      }),
    ).toEqual({ type: 'job', error: null });
  });

  it('uses a client as a whole-client thread', () => {
    expect(
      inferComposeType({
        people: [],
        entity: { kind: 'client', id: 'c1', name: 'Good Faith Partnership' },
      }),
    ).toEqual({ type: 'client', error: null });
  });

  it('uses one person as a direct chat', () => {
    expect(
      inferComposeType({
        people: [{ kind: 'contact', id: 'c1', name: 'Mariyum' }],
        entity: null,
      }),
    ).toEqual({ type: 'direct', error: null });
  });

  it('uses multiple people as a group', () => {
    expect(
      inferComposeType({
        people: [
          { kind: 'member', id: '1', name: 'Lucy' },
          { kind: 'member', id: '2', name: 'Rich' },
        ],
        entity: null,
      }),
    ).toEqual({ type: 'group', error: null });
  });

  it('requires a recipient', () => {
    expect(inferComposeType({ people: [], entity: null })).toEqual({
      type: null,
      error: 'Add a person, client, or project',
    });
  });
});

describe('formatWhoCanSee', () => {
  it('describes a direct chat', () => {
    expect(
      formatWhoCanSee({
        people: [{ kind: 'contact', id: '1', name: 'Mariyum' }],
        entity: null,
      }),
    ).toBe('Only you and Mariyum');
  });

  it('describes a group', () => {
    expect(
      formatWhoCanSee({
        people: [
          { kind: 'member', id: '1', name: 'Lucy' },
          { kind: 'member', id: '2', name: 'Rich' },
          { kind: 'contact', id: '3', name: 'Myra' },
        ],
        entity: null,
      }),
    ).toBe('You, Lucy, Rich, Myra');
  });

  it('describes a whole-client chat', () => {
    expect(
      formatWhoCanSee({
        people: [],
        entity: { kind: 'client', id: 'c1', name: 'Good Faith Partnership' },
      }),
    ).toBe('All portal contacts at Good Faith Partnership + you');
  });

  it('describes a project-linked chat', () => {
    expect(
      formatWhoCanSee({
        people: [{ kind: 'member', id: '1', name: 'Lucy' }],
        entity: { kind: 'project', id: 'p1', name: 'Brand refresh' },
      }),
    ).toBe('Only you and Lucy. Linked to Brand refresh.');
  });
});
