import { describe, expect, it } from 'vitest';

import { type BrochureStatusRecord, brochureStatus } from '../brochure-status';

function record(
  overrides: Partial<BrochureStatusRecord> = {},
): BrochureStatusRecord {
  return {
    orientation: 'landscape',
    updatedAt: '2026-10-01T10:00:00.000Z',
    approvedAt: null,
    approvedByName: null,
    publishedMediaId: null,
    ...overrides,
  };
}

describe('brochureStatus', () => {
  it('is not created without a saved layout', () => {
    expect(brochureStatus([])).toEqual({ kind: 'not_created' });
  });

  it('is a draft until a layout is published', () => {
    expect(
      brochureStatus([
        record({ orientation: 'portrait', updatedAt: '2026-10-02T09:00:00Z' }),
        record({ orientation: 'landscape', updatedAt: '2026-10-01T09:00:00Z' }),
      ]),
    ).toEqual({ kind: 'draft', orientation: 'portrait' });
  });

  it('is published with the approver when nothing changed since', () => {
    expect(
      brochureStatus([
        record({
          updatedAt: '2026-10-01T10:00:00.000Z',
          approvedAt: '2026-10-01T10:05:00.000Z',
          approvedByName: 'Dan Potter',
          publishedMediaId: 'media-1',
        }),
      ]),
    ).toEqual({
      kind: 'published',
      orientation: 'landscape',
      approvedAt: '2026-10-01T10:05:00.000Z',
      approvedByName: 'Dan Potter',
    });
  });

  it('is edited since publishing when the layout changed after approval', () => {
    const status = brochureStatus([
      record({
        updatedAt: '2026-10-03T08:00:00.000Z',
        approvedAt: '2026-10-01T10:05:00.000Z',
        publishedMediaId: 'media-1',
      }),
    ]);
    expect(status.kind).toBe('edited');
  });

  it('uses the published orientation when the other is a newer draft', () => {
    const status = brochureStatus([
      record({ orientation: 'portrait', updatedAt: '2026-10-05T08:00:00Z' }),
      record({
        orientation: 'landscape',
        approvedAt: '2026-10-01T10:05:00.000Z',
        publishedMediaId: 'media-1',
      }),
    ]);
    expect(status).toMatchObject({
      kind: 'published',
      orientation: 'landscape',
    });
  });
});
