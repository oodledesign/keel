import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import {
  addNativeSurveyPhoto,
  createNativeSurvey,
  createNativeSurveySession,
  getNativeSurvey,
  listNativeSurveys,
} from './surveys';
import type { NativeWorkspace } from './workspace-shared';

const { groupSurveyObservations, cleanSurveyTranscript } = vi.hoisted(() => ({
  groupSurveyObservations: vi.fn(),
  cleanSurveyTranscript: vi.fn(),
}));

vi.mock('~/lib/ai/survey-observation-group', () => ({
  groupSurveyObservations,
}));

vi.mock('~/lib/ai/survey-transcript-cleanup', () => ({
  cleanSurveyTranscript,
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
    cleanSurveyTranscript.mockReset();
    groupSurveyObservations.mockResolvedValue({
      drafts: [
        { sectionKey: 'windows', body: 'The sash is stiff.', sortOrder: 0 },
      ],
      source: 'keyword_fallback',
    });
    cleanSurveyTranscript.mockImplementation(
      async ({ sourceText }: { sourceText: string }) => ({
        cleanedText: sourceText.replace(/^Um,\s*/i, ''),
        source: 'ai',
      }),
    );
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
    expect(cleanSurveyTranscript).toHaveBeenCalled();
    expect(observationInsert.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          section_key: 'windows',
          body: 'The sash is stiff.',
          source_body: 'The sash is stiff.',
          cleanup_source: 'ai',
        }),
      ]),
    );
    expect(result.session.id).toBe('sess-1');
    expect(result.grouping_source).toBe('keyword_fallback');
    expect(result.session.rics_code).toBeNull();
    expect(result.cleanup_source).toBe('ai');
  });

  it('uses the surveyor-chosen section, cleans the note, and appends', async () => {
    const surveyLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: surveyId,
          title: '12 High Street',
          status: 'draft',
          survey_type: 'rics_hss_l2',
          survey_level: 2,
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
          id: 'sess-2',
          title: 'F3 Water',
          content: 'Um, supply pipework is copper.',
          source: 'desktop_recorder',
          duration_seconds: 18,
          meeting_date: '2026-09-16',
          created_at: '2026-09-16T11:00:00Z',
        },
        error: null,
      }),
    };
    const existingObservation = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'obs-f3', body: 'Stopcock is stiff.' },
        error: null,
      }),
    };
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    updateChain.eq.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    let observationCalls = 0;
    const from = vi.fn((table: string) => {
      if (table === 'proposals') return surveyLookup;
      if (table === 'meeting_transcripts') return transcriptInsert;
      if (table === 'survey_observations') {
        observationCalls += 1;
        return observationCalls === 1 ? existingObservation : updateChain;
      }
      return surveyLookup;
    });

    const result = await createNativeSurveySession({
      client: { from } as never,
      userId: 'user-dan',
      workspace: surveyor,
      surveyId,
      title: 'F3 Water',
      content: 'Um, supply pipework is copper.',
      durationSeconds: 18,
      meetingDate: '2026-09-16',
      source: 'iphone',
      ricsCode: 'F3',
    });

    expect(groupSurveyObservations).not.toHaveBeenCalled();
    expect(cleanSurveyTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: 'Um, supply pipework is copper.',
        ricsCode: 'F3',
        sectionKey: 'water',
      }),
    );
    expect(result.grouping_source).toBe('user');
    expect(result.cleanup_source).toBe('ai');
    expect(result.session.rics_code).toBe('F3');
    expect(result.session.section_key).toBe('water');
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Stopcock is stiff.\n\nsupply pipework is copper.',
        source_body: 'Stopcock is stiff.\n\nUm, supply pipework is copper.',
        cleanup_source: 'ai',
        rics_code: 'F3',
        section_key: 'water',
      }),
    );
    expect(updateChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ transcript_id: 'sess-2' }),
    );
  });

  it('skips grouping when rics_code is set and cleans a new section note', async () => {
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
          id: 'sess-2',
          title: 'F3 Water',
          content: 'Um, the stopcock is stiff.',
          source: 'iphone',
          duration_seconds: 12,
          meeting_date: '2026-09-16',
          created_at: '2026-09-16T11:00:00Z',
        },
        error: null,
      }),
    };
    const observationLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
        if (observationCalls === 1) return observationLookup;
        if (observationCalls === 2) return observationMax;
        return observationInsert;
      }
      return surveyLookup;
    });

    const result = await createNativeSurveySession({
      client: { from } as never,
      userId: 'user-dan',
      workspace: surveyor,
      surveyId,
      title: 'F3 Water',
      content: 'Um, the stopcock is stiff.',
      ricsCode: 'F3',
    });

    expect(groupSurveyObservations).not.toHaveBeenCalled();
    expect(cleanSurveyTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: 'Um, the stopcock is stiff.',
        ricsCode: 'F3',
        sectionKey: 'water',
      }),
    );
    expect(observationInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        section_key: 'water',
        rics_code: 'F3',
        body: 'the stopcock is stiff.',
        source_body: 'Um, the stopcock is stiff.',
        cleanup_source: 'ai',
      }),
    );
    expect(result.grouping_source).toBe('user');
    expect(result.cleanup_source).toBe('ai');
  });

  it('rejects a desk-only or unknown section code', async () => {
    await expect(
      createNativeSurveySession({
        client: { from: vi.fn() } as never,
        userId: 'user-dan',
        workspace: surveyor,
        surveyId,
        title: 'About the inspection',
        content: 'Weather was dry.',
        ricsCode: 'A',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'rics_code must be an on-site survey section',
    });
    expect(groupSurveyObservations).not.toHaveBeenCalled();
  });
});

describe('addNativeSurveyPhoto', () => {
  it('pins a photo to the chosen section', async () => {
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
    const docInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'photo-1',
          title: 'F3 Water',
          mime_type: 'image/jpeg',
          created_at: '2026-09-16T11:00:00Z',
          pinned_section_key: 'water',
        },
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'proposals') return surveyLookup;
      if (table === 'docs') return docInsert;
      return surveyLookup;
    });

    const photo = await addNativeSurveyPhoto({
      client: { from } as never,
      userId: 'user-dan',
      workspace: surveyor,
      surveyId,
      bytes: Buffer.from('fake-image'),
      filename: 'stopcock.jpg',
      mimeType: 'image/jpeg',
      title: 'F3 Water',
      ricsCode: 'F3',
    });

    expect(docInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pinned_section_key: 'water',
        photo_role: 'curated',
        tags: ['survey_photo', 'rics:F3'],
      }),
    );
    expect(photo.rics_code).toBe('F3');
    expect(photo.section_key).toBe('water');
  });
});

describe('getNativeSurvey', () => {
  it('returns on-site sections with the accumulated note and tagged photos', async () => {
    const surveyLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: surveyId,
          title: '12 High Street',
          status: 'draft',
          survey_type: 'rics_hss_l2',
          survey_level: 2,
          client_id: clientId,
          created_at: '2026-09-15T10:00:00Z',
          updated_at: '2026-09-15T10:00:00Z',
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
    const sessionChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'sess-1',
            title: 'F3 Water',
            content: 'Stopcock is stiff.',
            source: 'desktop_recorder',
            duration_seconds: 12,
            meeting_date: '2026-09-15',
            created_at: '2026-09-15T11:00:00Z',
          },
        ],
        error: null,
      }),
    };
    const photoChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'photo-1',
            title: 'F3 Water',
            mime_type: 'image/jpeg',
            created_at: '2026-09-16T11:00:00Z',
            file_path: 'path/stopcock.jpg',
            pinned_section_key: 'water',
            kind: 'uploaded',
          },
        ],
        error: null,
      }),
    };
    const observationChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            transcript_id: 'sess-1',
            section_key: 'water',
            rics_code: 'F3',
            body: 'Stopcock is stiff.\n\nSupply pipework is copper.',
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'proposals') return surveyLookup;
      if (table === 'clients') return clientChain;
      if (table === 'meeting_transcripts') return sessionChain;
      if (table === 'docs') return photoChain;
      if (table === 'survey_observations') return observationChain;
      return surveyLookup;
    });

    const detail = await getNativeSurvey({ from } as never, surveyor, surveyId);
    const water = detail.sections.find((item) => item.rics_code === 'F3');

    expect(water?.label).toBe('F3 Water');
    expect(water?.note).toBe(
      'Stopcock is stiff.\n\nSupply pipework is copper.',
    );
    expect(water?.photo_count).toBe(1);
    expect(detail.sessions[0]?.rics_code).toBe('F3');
    expect(detail.photos[0]?.rics_code).toBe('F3');
    expect(detail.photos[0]?.section_key).toBe('water');
  });
});
