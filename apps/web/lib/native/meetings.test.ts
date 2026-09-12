import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMeetingSummary } from '~/lib/recorder/meeting-summary';

import { NativeHttpError } from './http';
import {
  createNativeMeeting,
  getNativeMeeting,
  listNativeMeetings,
  listNativeUpcomingMeetings,
} from './meetings';
import {
  normalizeNativeMeetingContent,
  parseNativeMeetingDate,
  parseNativeMeetingSource,
  storedMeetingSource,
  toNativeMeeting,
} from './meetings-shared';
import type { NativeWorkspace } from './workspace-shared';

vi.mock('~/lib/brain/sync', () => ({
  queueBrainIndexSource: vi.fn(),
}));

vi.mock('~/lib/recorder/meeting-summary', () => ({
  loadMeetingSummary: vi.fn(),
}));

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('parseNativeMeetingDate', () => {
  it('accepts YYYY-MM-DD and blank', () => {
    expect(parseNativeMeetingDate('2026-09-01')).toBe('2026-09-01');
    expect(parseNativeMeetingDate(null)).toBeNull();
    expect(parseNativeMeetingDate('')).toBeNull();
  });

  it('rejects junk', () => {
    expect(() => parseNativeMeetingDate('01/09/2026')).toThrow(NativeHttpError);
  });
});

describe('parseNativeMeetingSource', () => {
  it('stores iphone as desktop_recorder so the existing CHECK holds', () => {
    expect(parseNativeMeetingSource('iphone')).toBe('desktop_recorder');
    expect(parseNativeMeetingSource('desktop_recorder')).toBe(
      'desktop_recorder',
    );
    expect(parseNativeMeetingSource(undefined)).toBe('desktop_recorder');
  });

  it('rejects unknown sources', () => {
    expect(() => parseNativeMeetingSource('notes')).toThrow(NativeHttpError);
  });
});

describe('normalizeNativeMeetingContent', () => {
  it('keeps Speaker: markdown', () => {
    const body = 'Me: Hello\n\nSpeaker 1: Hi there';
    expect(normalizeNativeMeetingContent(body)).toBe(body);
  });

  it('converts iOS heading blocks into Speaker: lines', () => {
    expect(
      normalizeNativeMeetingContent(
        'Me\n\nHello from the site\n\nSpeaker 1\n\nThanks',
      ),
    ).toBe('Me: Hello from the site\n\nSpeaker 1: Thanks');
  });

  it('converts markdown H2 speaker headings into Speaker: lines', () => {
    expect(
      normalizeNativeMeetingContent(
        '## Me\n\nWelcome to the show\n\n## Speaker 1\n\nhonour',
      ),
    ).toBe('Me: Welcome to the show\n\nSpeaker 1: honour');
  });
});

describe('toNativeMeeting', () => {
  it('maps a row for the phone list', () => {
    expect(
      toNativeMeeting(
        {
          id: 'm1',
          title: 'Site visit',
          content: 'Me: Hello',
          client_id: clientId,
          meeting_date: '2026-09-01',
          source: 'iphone',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        studio,
        'Hope and Wonder',
      ),
    ).toEqual({
      id: 'm1',
      title: 'Site visit',
      content: 'Me: Hello',
      workspace: 'oodle',
      client_id: clientId,
      client_name: 'Hope and Wonder',
      meeting_date: '2026-09-01',
      source: 'desktop_recorder',
      duration_seconds: null,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    });
  });

  it('maps duration_seconds when present', () => {
    expect(
      toNativeMeeting(
        {
          id: 'm1',
          title: 'Site visit',
          content: 'Me: Hello',
          client_id: clientId,
          meeting_date: '2026-09-01',
          source: 'desktop_recorder',
          duration_seconds: 1500,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        studio,
        'Hope and Wonder',
      ).duration_seconds,
    ).toBe(1500);
  });

  it('falls back unknown stored sources to desktop_recorder', () => {
    expect(storedMeetingSource('nope')).toBe('desktop_recorder');
    expect(storedMeetingSource('paste')).toBe('paste');
  });
});

describe('listNativeMeetings', () => {
  it('lists workspace transcripts with client names and task flags', async () => {
    const meetingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'm1',
            title: 'Site visit',
            content: 'Me: Hello',
            client_id: clientId,
            meeting_date: '2026-09-01',
            source: 'desktop_recorder',
            duration_seconds: 1500,
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-01T10:00:00Z',
          },
        ],
        error: null,
      }),
    };
    const clientChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: clientId,
            display_name: 'Hope and Wonder',
            first_name: null,
            last_name: null,
            company_name: null,
            client_type: 'individual',
          },
        ],
        error: null,
      }),
    };
    const actionChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation(() => actionChain),
    };
    actionChain.in = vi
      .fn()
      .mockReturnValueOnce(actionChain)
      .mockResolvedValueOnce({
        data: [{ meeting_transcript_id: 'm1' }],
        error: null,
      });
    const from = vi.fn((table: string) => {
      if (table === 'clients') return clientChain;
      if (table === 'meeting_action_items') return actionChain;
      return meetingChain;
    });

    const items = await listNativeMeetings({ from } as never, studio);

    expect(from).toHaveBeenCalledWith('meeting_transcripts');
    expect(meetingChain.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(items).toEqual([
      {
        id: 'm1',
        title: 'Site visit',
        content: 'Me: Hello',
        workspace: 'oodle',
        client_id: clientId,
        client_name: 'Hope and Wonder',
        meeting_date: '2026-09-01',
        source: 'desktop_recorder',
        duration_seconds: 1500,
        has_extracted_tasks: true,
        created_at: '2026-09-01T10:00:00Z',
        updated_at: '2026-09-01T10:00:00Z',
      },
    ]);
  });
});

describe('listNativeUpcomingMeetings', () => {
  it('returns confirmed future bookings', async () => {
    const bookingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'b1',
            start_at: '2099-01-02T10:00:00Z',
            invitee_name: 'Alex Example',
            conferencing_url: 'https://meet.google.com/abc',
            status: 'confirmed',
            event_types: { name: 'Discovery call' },
            booking_pages: { title: 'Studio' },
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      expect(table).toBe('bookings');
      return bookingChain;
    });

    await expect(
      listNativeUpcomingMeetings({ from } as never, studio),
    ).resolves.toEqual([
      {
        id: 'b1',
        title: 'Discovery call',
        start_at: '2099-01-02T10:00:00Z',
        invitee_name: 'Alex Example',
        conferencing_url: 'https://meet.google.com/abc',
      },
    ]);
  });

  it('returns an empty list when bookings fail', async () => {
    const bookingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'relation missing' },
      }),
    };

    await expect(
      listNativeUpcomingMeetings({ from: () => bookingChain } as never, studio),
    ).resolves.toEqual([]);
  });
});

describe('createNativeMeeting', () => {
  it('requires a client in this workspace and inserts meeting_transcripts', async () => {
    const clientLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: clientId,
          display_name: 'Hope and Wonder',
          first_name: null,
          last_name: null,
          company_name: null,
          client_type: 'individual',
        },
        error: null,
      }),
    };
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'm1',
          title: 'Site visit',
          content: 'Me: Hello from the site',
          client_id: clientId,
          meeting_date: '2026-09-01',
          source: 'desktop_recorder',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        error: null,
      }),
    };
    const from = vi.fn((table: string) =>
      table === 'clients' ? clientLookup : insertChain,
    );

    const created = await createNativeMeeting({
      client: { from } as never,
      userId: 'user-dan',
      workspace: studio,
      title: 'Site visit',
      content: 'Me\n\nHello from the site',
      clientId,
      meetingDate: '2026-09-01',
      source: 'iphone',
      durationSeconds: 42,
    });

    expect(from).toHaveBeenCalledWith('clients');
    expect(from).toHaveBeenCalledWith('meeting_transcripts');
    expect(clientLookup.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: studio.id,
        client_id: clientId,
        title: 'Site visit',
        content: 'Me: Hello from the site',
        source: 'desktop_recorder',
        meeting_date: '2026-09-01',
        created_by: 'user-dan',
        duration_seconds: 42,
        speaker_segments: [{ speaker: 'Me', text: 'Hello from the site' }],
      }),
    );
    expect(created.id).toBe('m1');
    expect(created.client_name).toBe('Hope and Wonder');
  });

  it('rejects a missing client', async () => {
    await expect(
      createNativeMeeting({
        client: { from: vi.fn() } as never,
        userId: 'user-dan',
        workspace: studio,
        content: 'Me: Hello',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'A client is required',
    } satisfies Partial<NativeHttpError>);
  });

  it('rejects a client from another workspace', async () => {
    const clientLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    await expect(
      createNativeMeeting({
        client: { from: () => clientLookup } as never,
        userId: 'user-dan',
        workspace: studio,
        content: 'Me: Hello',
        clientId,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'client_id must belong to this workspace',
    } satisfies Partial<NativeHttpError>);
  });
});

describe('getNativeMeeting', () => {
  const meetingId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.mocked(loadMeetingSummary).mockResolvedValue({
      summaryText: 'Follow up on the site visit.',
      attendeeEmails: [],
      generatedAt: '2026-09-01T11:00:00Z',
    });
  });

  it('returns transcript, notes, and published tasks', async () => {
    const meetingLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: meetingId,
          title: 'Site visit',
          content: 'Me: Hello',
          client_id: clientId,
          meeting_date: '2026-09-01',
          source: 'desktop_recorder',
          duration_seconds: 1500,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        error: null,
      }),
    };
    const clientChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: clientId,
            display_name: 'Hope and Wonder',
            first_name: null,
            last_name: null,
            company_name: null,
            client_type: 'individual',
          },
        ],
        error: null,
      }),
    };
    const actionChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'ai-1',
            suggested_title: 'Send survey',
            suggested_description: null,
            suggested_due_date: '2026-09-03',
            suggested_assignee_id: null,
            status: 'approved',
            planner_task_id: 'task-1',
          },
        ],
        error: null,
      }),
    };
    const plannerChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-1',
            title: 'Send survey pack',
            due_date: '2026-09-04',
            user_id: null,
            status: 'todo',
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'clients') return clientChain;
      if (table === 'meeting_action_items') return actionChain;
      if (table === 'tasks') return plannerChain;
      return meetingLookup;
    });

    const detail = await getNativeMeeting({ from } as never, studio, meetingId);

    expect(detail.id).toBe(meetingId);
    expect(detail.client_name).toBe('Hope and Wonder');
    expect(detail.duration_seconds).toBe(1500);
    expect(detail.notes).toEqual({
      text: 'Follow up on the site visit.',
      generated_at: '2026-09-01T11:00:00Z',
    });
    expect(detail.tasks).toEqual([
      {
        id: 'task-1',
        title: 'Send survey pack',
        due: '2026-09-04',
        status: 'todo',
        assignee_name: null,
        planner_task_id: 'task-1',
        client_id: clientId,
        client_name: 'Hope and Wonder',
      },
    ]);
  });

  it('404s for a junk id', async () => {
    await expect(
      getNativeMeeting({ from: vi.fn() } as never, studio, 'not-a-uuid'),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Meeting not found',
    } satisfies Partial<NativeHttpError>);
  });
});
