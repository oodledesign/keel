import { describe, expect, it } from 'vitest';

import { resolveMcpCreateDurationMinutes } from './duration';
import {
  createTaskSchema,
  resolveTaskPhaseAssignment,
  updateTaskSchema,
} from './tasks';

const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = '66666666-6666-4666-8666-666666666666';
const PHASE_ID = '55555555-5555-4555-8555-555555555555';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function createPhaseLookup(phase: Record<string, unknown> | null) {
  return {
    from(table: string) {
      if (table !== 'project_phases') {
        throw new Error(`unexpected table ${table}`);
      }

      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: phase, error: null });
        },
      };

      return builder;
    },
  };
}

describe('create path duration defaulting', () => {
  it('uses the caller value when duration_minutes is provided', () => {
    expect(
      resolveMcpCreateDurationMinutes({
        title: 'Quick email',
        duration_minutes: 90,
      }),
    ).toBe(90);
  });

  it('estimates from the title when duration_minutes is omitted', () => {
    expect(
      resolveMcpCreateDurationMinutes({
        title: 'Write homepage copy',
      }),
    ).toBe(60);
    expect(
      resolveMcpCreateDurationMinutes({
        title: 'Catch up with Oodle',
      }),
    ).toBe(30);
  });

  it('keeps create_task duration_minutes optional on the schema', () => {
    expect(createTaskSchema.parse({ title: 'Write brief' })).toMatchObject({
      title: 'Write brief',
    });
    expect(
      createTaskSchema.parse({ title: 'Write brief' }).duration_minutes,
    ).toBeUndefined();
  });

  it('does not invent duration_minutes on an unrelated update patch', () => {
    expect(
      updateTaskSchema.parse({
        id: '77777777-7777-4777-8777-777777777777',
        status: 'done',
      }),
    ).toEqual({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'done',
    });
  });
});

describe('task phase schemas', () => {
  it('accepts an optional phase_id on create', () => {
    expect(
      createTaskSchema.parse({
        title: 'Write brief',
        project_id: PROJECT_ID,
        phase_id: PHASE_ID,
      }),
    ).toMatchObject({
      title: 'Write brief',
      project_id: PROJECT_ID,
      phase_id: PHASE_ID,
    });
  });

  it('allows clearing phase_id on update', () => {
    expect(
      updateTaskSchema.parse({
        id: '77777777-7777-4777-8777-777777777777',
        phase_id: null,
      }),
    ).toMatchObject({ phase_id: null });
  });
});

describe('resolveTaskPhaseAssignment', () => {
  it('accepts a phase that belongs to the target project', async () => {
    const supabase = createPhaseLookup({
      id: PHASE_ID,
      project_id: PROJECT_ID,
      account_id: ACCOUNT_ID,
    });

    await expect(
      resolveTaskPhaseAssignment(supabase as never, {
        phase_id: PHASE_ID,
        project_id: PROJECT_ID,
      }),
    ).resolves.toEqual({
      phase_id: PHASE_ID,
      inferred_project_id: PROJECT_ID,
      inferred_account_id: ACCOUNT_ID,
    });
  });

  it('infers project_id when creating a task with only phase_id', async () => {
    const supabase = createPhaseLookup({
      id: PHASE_ID,
      project_id: PROJECT_ID,
      account_id: ACCOUNT_ID,
    });

    await expect(
      resolveTaskPhaseAssignment(supabase as never, {
        phase_id: PHASE_ID,
      }),
    ).resolves.toMatchObject({
      phase_id: PHASE_ID,
      inferred_project_id: PROJECT_ID,
    });
  });

  it('rejects a phase from a different project', async () => {
    const supabase = createPhaseLookup({
      id: PHASE_ID,
      project_id: OTHER_PROJECT_ID,
      account_id: ACCOUNT_ID,
    });

    await expect(
      resolveTaskPhaseAssignment(supabase as never, {
        phase_id: PHASE_ID,
        project_id: PROJECT_ID,
      }),
    ).rejects.toThrow('Phase does not belong to this project');
  });

  it('rejects a missing phase', async () => {
    const supabase = createPhaseLookup(null);

    await expect(
      resolveTaskPhaseAssignment(supabase as never, {
        phase_id: PHASE_ID,
        existing_project_id: PROJECT_ID,
      }),
    ).rejects.toThrow('Phase not found');
  });

  it('clears phase_id when asked to unphase', async () => {
    await expect(
      resolveTaskPhaseAssignment({} as never, {
        phase_id: null,
        existing_project_id: PROJECT_ID,
        existing_phase_id: PHASE_ID,
      }),
    ).resolves.toEqual({ phase_id: null });
  });

  it('clears the old phase when the task moves to another project', async () => {
    await expect(
      resolveTaskPhaseAssignment({} as never, {
        project_id: OTHER_PROJECT_ID,
        existing_project_id: PROJECT_ID,
        existing_phase_id: PHASE_ID,
      }),
    ).resolves.toEqual({ phase_id: null });
  });

  it('leaves phase_id unchanged when the project stays the same', async () => {
    await expect(
      resolveTaskPhaseAssignment({} as never, {
        project_id: PROJECT_ID,
        existing_project_id: PROJECT_ID,
        existing_phase_id: PHASE_ID,
      }),
    ).resolves.toEqual({});
  });
});
