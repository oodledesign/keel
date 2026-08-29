import { describe, expect, it } from 'vitest';

import {
  BUILDING_SURVEY_SECTIONS,
  htmlFromRoutedSections,
  routeTranscriptToSections,
} from './report-sections';

describe('routeTranscriptToSections', () => {
  it('routes non-sequential window mentions into the windows section', () => {
    const transcript = [
      'Bedroom 1: the front sash window is stiff and the putty is cracked.',
      'The roof covering is generally sound with a few slipped slates to the rear.',
      'Bedroom 2: the casement window catch is missing.',
      'Kitchen: the window cill is decayed at the corner.',
      'Bedroom 4: double glazed unit has failed and is misted.',
    ].join('\n\n');

    const routed = routeTranscriptToSections(transcript);
    expect(routed.windows).toMatch(/sash window/i);
    expect(routed.windows).toMatch(/casement window/i);
    expect(routed.windows).toMatch(/window cill/i);
    expect(routed.windows).toMatch(/double glazed/i);
    expect(routed.roof_coverings).toMatch(/slipped slates/i);
  });

  it('builds HTML with every standard heading', () => {
    const html = htmlFromRoutedSections({ windows: 'Sash is stiff.' });
    for (const section of BUILDING_SURVEY_SECTIONS) {
      expect(html).toContain(`data-section="${section.key}"`);
      expect(html).toContain(section.heading);
    }
    expect(html).toContain('Sash is stiff.');
  });
});
