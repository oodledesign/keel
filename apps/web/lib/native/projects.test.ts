import { describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import { getNativeProject, listNativeProjects } from './projects';
import {
  countNativeProjectTasks,
  mapNativePhase,
  mapNativeProject,
  nativeProjectValue,
  parseNativeProjectListStatus,
  progressFromTaskRows,
  workspaceShowsNativeProjects,
} from './projects-shared';
import type { NativeWorkspace } from './workspace-shared';

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: null,
};

const family: NativeWorkspace = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'the-house',
  name: 'The House',
  profile: 'family',
  isPersonal: false,
  image: null,
};

const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const clientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const phaseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('workspaceShowsNativeProjects', () => {
  it('shows Projects on studio / surveyor / commercial only', () => {
    expect(workspaceShowsNativeProjects('work_design')).toBe(true);
    expect(workspaceShowsNativeProjects('commercial_property')).toBe(true);
    expect(workspaceShowsNativeProjects('building_surveyor')).toBe(true);
    expect(workspaceShowsNativeProjects('personal')).toBe(false);
    expect(workspaceShowsNativeProjects('family')).toBe(false);
    expect(workspaceShowsNativeProjects('community')).toBe(false);
  });
});

describe('parseNativeProjectListStatus', () => {
  it('defaults to open and accepts done / all', () => {
    expect(parseNativeProjectListStatus(undefined)).toBe('open');
    expect(parseNativeProjectListStatus('active')).toBe('open');
    expect(parseNativeProjectListStatus('completed')).toBe('done');
    expect(parseNativeProjectListStatus('ALL')).toBe('all');
  });

  it('rejects unknown list statuses', () => {
    expect(() => parseNativeProjectListStatus('kanban')).toThrow(
      NativeHttpError,
    );
  });
});

describe('mapNativeProject', () => {
  it('uses title over name and formats value', () => {
    expect(
      mapNativeProject({
        id: projectId,
        name: 'Legacy name',
        title: 'ChurchWorks website',
        status: 'in_progress',
        client_id: clientId,
        start_date: '2026-09-01',
        due_date: '2026-10-01',
        is_phased: true,
        value_pence: 125000,
        clients: { display_name: 'Hope and Wonder', client_type: 'business' },
      }),
    ).toMatchObject({
      id: projectId,
      title: 'ChurchWorks website',
      status: 'in_progress',
      status_label: 'In progress',
      client_id: clientId,
      client_name: 'Hope and Wonder',
      start: '2026-09-01',
      due: '2026-10-01',
      is_phased: true,
      value: '£1,250.00',
      value_pence: 125000,
    });
  });

  it('clears due on ongoing projects', () => {
    expect(
      mapNativeProject({
        id: projectId,
        title: 'Retainer',
        is_ongoing: true,
        due_date: '2026-10-01',
      }).due,
    ).toBeNull();
  });
});

describe('native project helpers', () => {
  it('formats pence and ignores empty values', () => {
    expect(nativeProjectValue(2500)).toEqual({
      value: '£25.00',
      value_pence: 2500,
    });
    expect(nativeProjectValue(0)).toEqual({ value: null, value_pence: null });
  });

  it('counts open vs done tasks and computes progress', () => {
    expect(
      countNativeProjectTasks([
        { status: 'todo' },
        { status: 'in_progress' },
        { status: 'done' },
      ]),
    ).toEqual({ open: 2, done: 1, total: 3 });

    expect(
      progressFromTaskRows([
        { id: 't1', status: 'done', duration_minutes: 60 },
        { id: 't2', status: 'todo', duration_minutes: 60 },
      ]),
    ).toBe(50);
  });

  it('maps phase labels', () => {
    expect(
      mapNativePhase({
        id: phaseId,
        name: 'Discovery',
        status: 'in_progress',
        is_milestone: false,
        start_date: '2026-09-01',
        due_date: '2026-09-14',
        progress_pct: 40,
        task_count: 3,
      }),
    ).toMatchObject({
      id: phaseId,
      name: 'Discovery',
      status_label: 'In progress',
      start: '2026-09-01',
      due: '2026-09-14',
      progress_pct: 40,
      task_count: 3,
    });
  });
});

function statusChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
  chain.order.mockReturnValueOnce(chain).mockResolvedValueOnce({
    data: [],
    error: null,
  });
  return chain;
}

describe('listNativeProjects', () => {
  it('returns an empty list on personal and family without querying', async () => {
    const from = vi.fn();

    await expect(
      listNativeProjects({ from } as never, personal),
    ).resolves.toEqual({
      items: [],
      statuses: [],
    });
    await expect(
      listNativeProjects({ from } as never, family),
    ).resolves.toEqual({
      items: [],
      statuses: [],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('scopes delivery projects to the workspace and includes progress', async () => {
    const statuses = statusChain();
    const projects = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({
        data: [
          {
            id: projectId,
            title: 'ChurchWorks website',
            name: 'ChurchWorks website',
            status: 'in_progress',
            client_id: clientId,
            start_date: '2026-09-01',
            due_date: '2026-10-01',
            is_phased: true,
            value_pence: 125000,
            clients: {
              display_name: 'Hope and Wonder',
              client_type: 'business',
            },
          },
        ],
        error: null,
      }),
    };
    const tasks = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [
          {
            id: 't1',
            project_id: projectId,
            status: 'done',
            duration_minutes: 60,
          },
          {
            id: 't2',
            project_id: projectId,
            status: 'todo',
            duration_minutes: 60,
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'project_statuses') return statuses;
      if (table === 'tasks') return tasks;
      return projects;
    });

    const payload = await listNativeProjects({ from } as never, studio);

    expect(from).toHaveBeenCalledWith('projects');
    expect(projects.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(projects.eq).toHaveBeenCalledWith('project_type', 'delivery');
    expect(tasks.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: projectId,
      title: 'ChurchWorks website',
      client_name: 'Hope and Wonder',
      is_phased: true,
      progress_pct: 50,
      task_counts: { open: 1, done: 1, total: 2 },
    });
    expect(
      payload.statuses.some((status) => status.slug === 'in_progress'),
    ).toBe(true);
  });
});

describe('getNativeProject', () => {
  it('returns 404 on personal without querying', async () => {
    const from = vi.fn();

    await expect(
      getNativeProject({ from } as never, personal, projectId),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<NativeHttpError>);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns detail with phases, tasks, and progress board defaults', async () => {
    const statuses = statusChain();
    const project = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: projectId,
          title: 'ChurchWorks website',
          name: 'ChurchWorks website',
          status: 'in_progress',
          description: 'Site rebuild',
          client_id: clientId,
          start_date: '2026-09-01',
          due_date: '2026-10-01',
          is_phased: true,
          value_pence: 125000,
          clients: {
            display_name: 'Hope and Wonder',
            client_type: 'business',
          },
        },
        error: null,
      }),
    };
    const phases = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: phaseId,
            name: 'Discovery',
            status: 'in_progress',
            is_milestone: false,
            colour: '#3B82F6',
            start_date: '2026-09-01',
            due_date: '2026-09-14',
            sort_order: 0,
          },
        ],
        error: null,
      }),
    };
    const tasks = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    tasks.order.mockReturnValueOnce(tasks).mockResolvedValueOnce({
      data: [
        {
          id: 't1',
          title: 'Kick-off',
          status: 'todo',
          due_date: '2026-09-04',
          duration_minutes: 30,
          account_id: studio.id,
          client_id: clientId,
          project_id: projectId,
          phase_id: phaseId,
          parent_task_id: null,
          assignee_contact_id: null,
        },
      ],
      error: null,
    });
    const clients = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            id: clientId,
            display_name: 'Hope and Wonder',
            client_type: 'business',
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'project_statuses') return statuses;
      if (table === 'project_phases') return phases;
      if (table === 'tasks') return tasks;
      if (table === 'clients') return clients;
      return project;
    });

    const detail = await getNativeProject({ from } as never, studio, projectId);

    expect(detail.title).toBe('ChurchWorks website');
    expect(detail.description).toBe('Site rebuild');
    expect(detail.is_phased).toBe(true);
    expect(detail.default_board_mode).toBe('phase');
    expect(detail.phases).toEqual([
      expect.objectContaining({
        id: phaseId,
        name: 'Discovery',
        status_label: 'In progress',
        task_count: 1,
      }),
    ]);
    expect(detail.tasks).toEqual([
      expect.objectContaining({
        id: 't1',
        title: 'Kick-off',
        phase_id: phaseId,
        phase_name: 'Discovery',
        client_name: 'Hope and Wonder',
      }),
    ]);
  });
});
