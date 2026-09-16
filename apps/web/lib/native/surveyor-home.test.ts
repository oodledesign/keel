import { describe, expect, it, vi } from 'vitest';

import { loadNativeSurveyorHome } from './surveyor-home';
import type { NativeWorkspace } from './workspace-shared';

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

describe('loadNativeSurveyorHome', () => {
  it('returns null on non-surveyor workspaces without querying', async () => {
    const from = vi.fn();
    await expect(
      loadNativeSurveyorHome({ from } as never, studio),
    ).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('maps pipeline counts, open deals, and recent surveys', async () => {
    const dealChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'deal-open',
            name: '12 High Street',
            stage: 'booked',
            contact_name: 'Alex',
            company_name: null,
            clients: { display_name: 'Alex Lane' },
          },
          {
            id: 'deal-enquiry',
            name: null,
            stage: 'enquiry',
            contact_name: 'Sam',
            company_name: 'Acme',
            clients: null,
          },
          {
            id: 'deal-done',
            name: 'Finished',
            stage: 'reported',
            contact_name: null,
            company_name: null,
            clients: null,
          },
        ],
        error: null,
      }),
    };
    const surveyChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'survey-1',
            title: 'Level 2 survey',
            status: 'draft',
            updated_at: '2026-09-15T10:00:00Z',
            clients: { display_name: 'Alex Lane' },
          },
        ],
        error: null,
      }),
    };

    const from = vi.fn((table: string) => {
      if (table === 'pipeline_deals') return dealChain;
      if (table === 'proposals') return surveyChain;
      throw new Error(`unexpected table ${table}`);
    });

    const payload = await loadNativeSurveyorHome({ from } as never, surveyor);

    expect(payload).toMatchObject({
      open_count: 2,
      enquiry_count: 1,
      booked_count: 1,
      surveyed_count: 0,
    });
    expect(payload?.pipeline.map((deal) => deal.id)).toEqual([
      'deal-open',
      'deal-enquiry',
    ]);
    expect(payload?.pipeline[0]).toMatchObject({
      title: '12 High Street',
      stage_label: 'Booked',
      client_name: 'Alex Lane',
    });
    expect(payload?.recent_surveys).toEqual([
      {
        id: 'survey-1',
        title: 'Level 2 survey',
        status: 'draft',
        updated_at: '2026-09-15T10:00:00Z',
        client_name: 'Alex Lane',
      },
    ]);
  });
});
