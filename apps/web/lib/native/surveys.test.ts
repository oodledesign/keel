import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import {
  createNativeSurvey,
  createNativeSurveySession,
  listNativeSurveys,
} from './surveys';
import type { NativeWorkspace } from './workspace-shared';

const { groupSurveyObservations } = vi.hoisted(() => ({
  groupSurveyObservations: vi.fn(),
}));

vi.mock('~/lib/ai/survey-observation-group', () => ({
  groupSurveyObservations,
}));

vi.mock('~/lib/brain/sync', () => ({
  queueBrainIndexSource: vi.fn(),
}));

vi.mock('@kit/supabase/server-admin-client', () => ({
  getSupabaseServerAdminClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://files.example/photo.jpg' },
        }),
      }),
    },
  }),
}));

const surveyor: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'bracketts',
  name: 'Bracketts',
  profile: 'building_surveyor',
  isPersonal: false,
  image: null,
};

const studio: NativeWorkspace = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const surveyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const clientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('listNativeSurveys', () => {
  it('returns an empty list on non-surveyor workspaces', async () => {
    const from = vi.fn();
    await expect(listNativeSurveys({ from } as never, studio)).resolves.toEqual(
      { items: [] },
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('maps survey_report rows with session and photo counts', async () => {
    const listChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: surveyId,
            title: '12 High Street',
            status: 'draft',
            survey_type: 'rics_hss_l2',
            client_id: clientId,
            created_at: '2026-09-15T10:00:00Z',
            updated_at: '2026-09-15T11:00:00Z',
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
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ proposal_id: surveyId }, { proposal_id: surveyId }],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'proposals') return listChain;
      if (table === 'clients') return clientChain;
      return countChain;
    });

    const payload = await listNativeSurveys({ from } as never, surveyor);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.title).toBe('12 High Street');
    expect(payload.items[0]?.client_name).toBe('Hope and Wonder');
    expect(payload.items[0]?.session_count).toBe(2);
    expect(payload.items[0]?.photo_count).toBe(2);
    expect(listChain.eq).toHaveBeenCalledWith('kind', 'survey_report');
  });
});

describe('createNativeSurvey', () => {
  it('rejects studio workspaces', async () => {
    await expect(
      createNativeSurvey({
        client: { from: vi.fn() } as never,
        userId: 'user-dan',
        workspace: studio,
        title: '12 High Street',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Surveys are only available on building surveyor workspaces',
    } satisfies Partial<NativeHttpError>);
  });

  it('creates a survey_report without a client', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: surveyId,
          title: '12 High Street',
          status: 'draft',
          survey_type: 'dilapidations',
          client_id: null,
          created_at: '2026-09-15T10:00:00Z',
          updated_at: '2026-09-15T10:00:00Z',
        },
        error: null,
      }),
    };

    const created = await createNativeSurvey({
      client: { from: () => insertChain } as never,
      userId: 'user-dan',
      workspace: surveyor,
      title: '12 High Street',
      surveyType: 'dilapidations',
    });

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: surveyor.id,
        kind: 'survey_report',
        title: '12 High Street',
        survey_type: 'dilapidations',
        client_id: null,
        created_by: 'user-dan',
      }),
    );
    expect(created.id).toBe(surveyId);
    expect(created.survey_type_label).toBe('Dilapidations');
  });
});

describe('createNativeSurveySession', () => {
  beforeEach(() => {
    groupSurveyObservations.mockReset();
    groupSurveyObservations.mockResolvedValue({
      drafts: [
        { sectionKey: 'windows', body: 'The sash is stiff.', sortOrder: 0 },
      ],
      source: 'keyword_fallback',
    });
  });

  it('inserts a meeting_transcript linked to the survey and groups sections', async () => {
    const surveyLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: surveyId,
          title: '12 High Street',
          status: 'draft',
          survey_type: 'rics_hss_l2',
          client_id: clientId,
          created_at: '2026-09-15T10:00:00Z',
          updated_at: '2026-09-15T10:00:00Z',
        },
        error: null,
      }),
    };
    const transcriptInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'sess-1',
          title: 'Site notes',
          content: 'The sash window is stiff.',
          source: 'desktop_recorder',
          duration_seconds: 42,
          meeting_date: '2026-09-15',
          created_at: '2026-09-15T11:00:00Z',
        },
        error: null,
      }),
    };
    const observationMax = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const observationInsert = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    let observationCalls = 0;

    const from = vi.fn((table: string) => {
      if (table === 'proposals') return surveyLookup;
      if (table === 'meeting_transcripts') return transcriptInsert;
      if (table === 'survey_observations') {
        observationCalls += 1;
        return observationCalls === 1 ? observationMax : observationInsert;
      }
      return surveyLookup;
    });

    const result = await createNativeSurveySession({
      client: { from } as never,
      userId: 'user-dan',
      workspace: surveyor,
      surveyId,
      title: 'Site notes',
      content: 'The sash window is stiff.',
      durationSeconds: 42,
      meetingDate: '2026-09-15',
      source: 'iphone',
    });

    expect(transcriptInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: surveyor.id,
        proposal_id: surveyId,
        client_id: clientId,
        title: 'Site notes',
        source: 'desktop_recorder',
        duration_seconds: 42,
      }),
    );
    expect(groupSurveyObservations).toHaveBeenCalled();
    expect(result.session.id).toBe('sess-1');
    expect(result.grouping_source).toBe('keyword_fallback');
  });
});
