import { describe, expect, it } from 'vitest';

import {
  BUILDING_SURVEY_SECTIONS,
  applyObservationSectionKeys,
  htmlFromObservations,
  htmlFromRoutedSections,
  observationsFromTranscript,
  routeTranscriptToSections,
} from './report-sections';

const WINDOW_TRANSCRIPT = [
  'Bedroom 1: the front sash window is stiff and the putty is cracked.',
  'The roof covering is generally sound with a few slipped slates to the rear.',
  'Bedroom 2: the casement window catch is missing.',
  'Kitchen: the window cill is decayed at the corner.',
  'Bedroom 4: double glazed unit has failed and is misted.',
].join('\n\n');

describe('routeTranscriptToSections', () => {
  it('routes non-sequential window mentions into the windows section', () => {
    const routed = routeTranscriptToSections(WINDOW_TRANSCRIPT);
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

describe('observationsFromTranscript', () => {
  it('keeps each paragraph as its own editable observation', () => {
    const observations = observationsFromTranscript(WINDOW_TRANSCRIPT);
    expect(observations).toHaveLength(5);
    expect(
      observations.filter((item) => item.sectionKey === 'windows'),
    ).toHaveLength(4);
    expect(
      observations.find((item) => item.sectionKey === 'roof_coverings')?.body,
    ).toMatch(/slipped slates/i);
  });

  it('lets a surveyor-style reassignment stay independent of keyword routing', () => {
    const observations = observationsFromTranscript(
      'The front sash window is stiff.\n\nThe boiler is dated but working.',
    );
    const reassigned = observations.map((item) =>
      item.sectionKey === 'heating'
        ? { ...item, sectionKey: 'water_heating' }
        : item,
    );

    expect(reassigned.some((item) => item.sectionKey === 'windows')).toBe(true);
    expect(reassigned.some((item) => item.sectionKey === 'water_heating')).toBe(
      true,
    );
    expect(reassigned.some((item) => item.sectionKey === 'heating')).toBe(
      false,
    );
  });
});

describe('applyObservationSectionKeys', () => {
  it('uses valid AI keys and falls back to keywords for the rest', () => {
    const drafts = applyObservationSectionKeys(
      [
        'The front sash window is stiff.',
        'The boiler is dated but working.',
        'A few slipped slates to the rear.',
      ],
      [
        { index: 0, sectionKey: 'windows' },
        { index: 1, sectionKey: 'not_a_section' },
        { index: 2, sectionKey: 'roof_coverings' },
      ],
    );

    expect(drafts[0]?.sectionKey).toBe('windows');
    expect(drafts[1]?.sectionKey).toBe('heating');
    expect(drafts[2]?.sectionKey).toBe('roof_coverings');
  });
});

describe('htmlFromObservations', () => {
  it('includes observation text and pinned photo captions under the section', () => {
    const html = htmlFromObservations(
      [{ sectionKey: 'windows', body: 'Sash is stiff.' }],
      [
        {
          sectionKey: 'windows',
          title: 'Front elevation window',
          caption: 'Cracked putty to the lower sash.',
        },
      ],
    );

    expect(html).toContain('Sash is stiff.');
    expect(html).toContain('Photo: Front elevation window');
    expect(html).toContain('Cracked putty to the lower sash.');
    expect(html).toContain('data-section="windows"');
  });
});
