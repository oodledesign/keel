import { describe, expect, it } from 'vitest';

import {
  brochureOriginForMode,
  brochurePillLabel,
  originAfterMergeNotes,
  parseBrochureMapping,
} from './brochure-import';

describe('brochure-import', () => {
  it('parses AI mapping JSON and ignores unknown sections', () => {
    const parsed = parseBrochureMapping({
      sections: [
        {
          sectionKey: 'location',
          exactText: 'Quiet cul-de-sac.',
          rewrittenText: 'The property sits on a quiet cul-de-sac.',
        },
        {
          sectionKey: 'windows',
          exactText: 'ignored',
          rewrittenText: 'ignored',
        },
        {
          sectionKey: 'grounds',
          exactText: 'Rear garden.',
          rewrittenText: 'There is a rear garden.',
        },
      ],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.sectionKey).toBe('location');
    expect(parsed[1]?.sectionKey).toBe('grounds');
  });

  it('labels brochure pills and switches to Edited when body diverges', () => {
    expect(
      brochurePillLabel({
        origin: 'brochure_exact',
        body: 'Quiet cul-de-sac.',
        originBody: 'Quiet cul-de-sac.',
      }),
    ).toBe('From PDF (exact)');

    expect(
      brochurePillLabel({
        origin: 'brochure_ai',
        body: 'The property sits on a quiet cul-de-sac.',
        originBody: 'The property sits on a quiet cul-de-sac.',
      }),
    ).toBe('From PDF (AI rewritten)');

    expect(
      brochurePillLabel({
        origin: 'brochure_exact',
        body: 'Quiet cul-de-sac with parking.',
        originBody: 'Quiet cul-de-sac.',
      }),
    ).toBe('Edited');
  });

  it('maps import mode onto origin and marks merges as edited', () => {
    expect(brochureOriginForMode('exact')).toBe('brochure_exact');
    expect(brochureOriginForMode('rewritten')).toBe('brochure_ai');

    expect(
      originAfterMergeNotes({
        previousOrigin: 'brochure_exact',
        previousOriginBody: 'A',
        mergedBody: 'A\n\nB',
      }),
    ).toEqual({ origin: 'edited', originBody: 'A' });
  });
});
