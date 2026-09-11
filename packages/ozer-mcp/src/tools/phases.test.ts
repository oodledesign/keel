import { describe, expect, it } from 'vitest';

import {
  assertAccountInWorkspaces,
  buildCreatePhaseInsert,
  buildUpdatePhasePatch,
  createProjectPhase,
  createProjectPhaseSchema,
  deleteProjectPhase,
  listProjectPhases,
  listProjectPhasesSchema,
  mapPhase,
  nextPhaseSortOrder,
  updateProjectPhase,
  updateProjectPhaseSchema,
} from './phases';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const PHASE_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '33333333-3333-4333-8333-333333333333';

type Row = Record<string, unknown>;

function matches(row: Row, filters: Record<string, unknown>) {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function createMockSupabase(config: {
  workspaces?: Array<{ id: string; name?: string; slug?: string }>;
  projects?: Row[];
  phases?: Row[];
}) {
  const workspaces = config.workspaces ?? [
    { id: ACCOUNT_ID, name: 'Oodle', slug: 'oodle' },
  ];
  const inserts: Row[] = [];
  const updates: Row[] = [];
  const deletes: Array<Record<string, unknown>> = [];

  return {
    inserts,
    updates,
    deletes,
    from(table: string) {
      const state = {
        filters: {} as Record<string, unknown>,
        op: 'select',
        payload: undefined as unknown,
        orderCol: undefined as string | undefined,
        ascending: true,
        limitN: undefined as number | undefined,
        wantSingle: false,
      };

      const resolve = () => {
        if (table === 'accounts_memberships') {
          return {
            data: workspaces.map((workspace) => ({
              account_id: workspace.id,
              account: {
                id: workspace.id,
                name: workspace.name ?? null,
                slug: workspace.slug ?? null,
                space_type: null,
                is_personal_account: false,
              },
            })),
            error: null,
          };
        }

        if (table === 'projects') {
          const rows = (config.projects ?? []).filter((row) =>
            matches(row, state.filters),
          );
          return {
            data: state.wantSingle ? (rows[0] ?? null) : rows,
            error: null,
          };
        }

        if (table === 'project_phases') {
          if (state.op === 'insert') {
            const row = {
              id: 'phase-new',
              created_at: '2026-09-11T00:00:00Z',
              updated_at: '2026-09-11T00:00:00Z',
              completed_at: null,
              ...(state.payload as Row),
            };
            inserts.push(row);
            return { data: row, error: null };
          }

          if (state.op === 'update') {
            const existing = (config.phases ?? []).find((row) =>
              matches(row, state.filters),
            );
            if (!existing) {
              return { data: null, error: null };
            }
            const row = { ...existing, ...(state.payload as Row) };
            updates.push(row);
            return { data: row, error: null };
          }

          if (state.op === 'delete') {
            deletes.push({ ...state.filters });
            return { data: null, error: null };
          }

          let rows = (config.phases ?? []).filter((row) =>
            matches(row, state.filters),
          );
          if (state.orderCol === 'sort_order') {
            rows = [...rows].sort((left, right) => {
              const delta =
                Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0);
              return state.ascending ? delta : -delta;
            });
          }
          if (state.limitN != null) {
            rows = rows.slice(0, state.limitN);
          }
          return {
            data: state.wantSingle ? (rows[0] ?? null) : rows,
            error: null,
          };
        }

        return { data: null, error: { message: `unexpected table ${table}` } };
      };

      const builder = {
        select() {
          return builder;
        },
        insert(row: Row) {
          state.op = 'insert';
          state.payload = row;
          return builder;
        },
        update(row: Row) {
          state.op = 'update';
          state.payload = row;
          return builder;
        },
        delete() {
          state.op = 'delete';
          return builder;
        },
        eq(column: string, value: unknown) {
          state.filters[column] = value;
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          state.orderCol = column;
          state.ascending = options?.ascending !== false;
          return builder;
        },
        limit(value: number) {
          state.limitN = value;
          return builder;
        },
        maybeSingle() {
          state.wantSingle = true;
          return Promise.resolve(resolve());
        },
        single() {
          state.wantSingle = true;
          return Promise.resolve(resolve());
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(resolve()).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };
}

const authorizedProject = {
  id: PROJECT_ID,
  account_id: ACCOUNT_ID,
  is_phased: true,
};

const discoveryPhase = {
  id: PHASE_ID,
  account_id: ACCOUNT_ID,
  project_id: PROJECT_ID,
  name: 'Discovery',
  description: 'Kickoff',
  status: 'not_started',
  is_milestone: false,
  colour: '#3B82F6',
  sort_order: 0,
  start_date: null,
  due_date: null,
  completed_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('phase schemas', () => {
  it('requires a project id to list and a name to create', () => {
    expect(() => listProjectPhasesSchema.parse({})).toThrow();
    expect(
      createProjectPhaseSchema.parse({
        project_id: PROJECT_ID,
        name: ' Design ',
      }),
    ).toMatchObject({
      project_id: PROJECT_ID,
      name: 'Design',
      status: 'not_started',
      is_milestone: false,
    });
  });

  it('accepts the same patch fields as the web app', () => {
    expect(
      updateProjectPhaseSchema.parse({
        id: PHASE_ID,
        name: 'Build',
        sort_order: 2,
        status: 'in_progress',
        due_date: '2026-10-01',
      }),
    ).toMatchObject({
      name: 'Build',
      sort_order: 2,
      status: 'in_progress',
    });
  });
});

describe('phase helpers', () => {
  it('appends after the highest sort_order', () => {
    expect(nextPhaseSortOrder(undefined)).toBe(0);
    expect(nextPhaseSortOrder(3)).toBe(4);
  });

  it('builds an insert matching project_phases columns', () => {
    expect(
      buildCreatePhaseInsert(
        createProjectPhaseSchema.parse({
          project_id: PROJECT_ID,
          name: 'Launch',
          description: 'Go live',
          due_date: '2026-11-01',
        }),
        ACCOUNT_ID,
        USER_ID,
        2,
      ),
    ).toEqual({
      account_id: ACCOUNT_ID,
      project_id: PROJECT_ID,
      name: 'Launch',
      description: 'Go live',
      status: 'not_started',
      is_milestone: false,
      colour: null,
      sort_order: 2,
      start_date: null,
      due_date: '2026-11-01',
      created_by: USER_ID,
    });
  });

  it('sets and clears completed_at when status changes', () => {
    expect(
      buildUpdatePhasePatch(
        updateProjectPhaseSchema.parse({ id: PHASE_ID, status: 'complete' }),
        'in_progress',
        () => '2026-09-11T12:00:00.000Z',
      ),
    ).toEqual({
      status: 'complete',
      completed_at: '2026-09-11T12:00:00.000Z',
    });

    expect(
      buildUpdatePhasePatch(
        updateProjectPhaseSchema.parse({
          id: PHASE_ID,
          status: 'in_progress',
        }),
        'complete',
      ),
    ).toEqual({
      status: 'in_progress',
      completed_at: null,
    });
  });

  it('maps phase rows for MCP JSON', () => {
    expect(mapPhase(discoveryPhase)).toMatchObject({
      id: PHASE_ID,
      project_id: PROJECT_ID,
      name: 'Discovery',
      sort_order: 0,
      is_milestone: false,
    });
  });

  it('rejects accounts the user does not belong to', () => {
    expect(() =>
      assertAccountInWorkspaces(
        [{ id: ACCOUNT_ID } as never],
        OTHER_ACCOUNT_ID,
      ),
    ).toThrow('Project not found');
  });
});

describe('phase handlers', () => {
  it('lists phases for an authorized project in sort order', async () => {
    const supabase = createMockSupabase({
      projects: [authorizedProject],
      phases: [
        { ...discoveryPhase, sort_order: 1, name: 'Build' },
        { ...discoveryPhase, id: 'phase-a', sort_order: 0, name: 'Discovery' },
      ],
    });

    const result = await listProjectPhases(supabase as never, USER_ID, {
      project_id: PROJECT_ID,
    });

    expect(result.phases.map((phase) => phase.name)).toEqual([
      'Discovery',
      'Build',
    ]);
  });

  it('hides phases when the project is outside the user workspaces', async () => {
    const supabase = createMockSupabase({
      workspaces: [{ id: ACCOUNT_ID, name: 'Oodle' }],
      projects: [
        { id: PROJECT_ID, account_id: OTHER_ACCOUNT_ID, is_phased: true },
      ],
      phases: [discoveryPhase],
    });

    await expect(
      listProjectPhases(supabase as never, USER_ID, { project_id: PROJECT_ID }),
    ).rejects.toThrow('Project not found');
  });

  it('creates a phase on an authorized project and appends sort_order', async () => {
    const supabase = createMockSupabase({
      projects: [authorizedProject],
      phases: [discoveryPhase],
    });

    const result = await createProjectPhase(supabase as never, USER_ID, {
      project_id: PROJECT_ID,
      name: 'Design',
      status: 'not_started',
      is_milestone: false,
    });

    expect(result.phase.name).toBe('Design');
    expect(supabase.inserts[0]).toMatchObject({
      account_id: ACCOUNT_ID,
      project_id: PROJECT_ID,
      name: 'Design',
      sort_order: 1,
      created_by: USER_ID,
    });
  });

  it('refuses to create a phase in a workspace the user cannot access', async () => {
    const supabase = createMockSupabase({
      workspaces: [],
      projects: [authorizedProject],
    });

    await expect(
      createProjectPhase(supabase as never, USER_ID, {
        project_id: PROJECT_ID,
        name: 'Design',
        status: 'not_started',
        is_milestone: false,
      }),
    ).rejects.toThrow('Project not found');
    expect(supabase.inserts).toHaveLength(0);
  });

  it('updates a phase the user can access', async () => {
    const supabase = createMockSupabase({
      phases: [discoveryPhase],
    });

    const result = await updateProjectPhase(supabase as never, USER_ID, {
      id: PHASE_ID,
      name: 'Discovery + research',
      sort_order: 3,
    });

    expect(result.phase.name).toBe('Discovery + research');
    expect(supabase.updates[0]).toMatchObject({
      name: 'Discovery + research',
      sort_order: 3,
    });
  });

  it('refuses to update a phase in another workspace', async () => {
    const supabase = createMockSupabase({
      workspaces: [{ id: ACCOUNT_ID }],
      phases: [{ ...discoveryPhase, account_id: OTHER_ACCOUNT_ID }],
    });

    await expect(
      updateProjectPhase(supabase as never, USER_ID, {
        id: PHASE_ID,
        name: 'Nope',
      }),
    ).rejects.toThrow('Phase not found');
    expect(supabase.updates).toHaveLength(0);
  });

  it('deletes a phase in the authorized workspace without deleting the project', async () => {
    const supabase = createMockSupabase({
      phases: [discoveryPhase],
    });

    await expect(
      deleteProjectPhase(supabase as never, USER_ID, { id: PHASE_ID }),
    ).resolves.toEqual({
      deleted: true,
      id: PHASE_ID,
      project_id: PROJECT_ID,
      tasks_unphased: true,
    });

    expect(supabase.deletes).toEqual([
      {
        id: PHASE_ID,
        account_id: ACCOUNT_ID,
        project_id: PROJECT_ID,
      },
    ]);
  });

  it('refuses to delete a phase the user cannot access', async () => {
    const supabase = createMockSupabase({
      workspaces: [],
      phases: [discoveryPhase],
    });

    await expect(
      deleteProjectPhase(supabase as never, USER_ID, { id: PHASE_ID }),
    ).rejects.toThrow('Phase not found');
    expect(supabase.deletes).toHaveLength(0);
  });
});
