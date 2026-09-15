/**
 * Standard UK building / RICS Home Survey headings.
 * Single source of truth for templates, transcript routing, and photo pins.
 */
export type BuildingSurveySection = {
  key: string;
  heading: string;
  group: string;
  keywords: readonly string[];
};

export const BUILDING_SURVEY_SECTIONS: readonly BuildingSurveySection[] = [
  {
    key: 'about_inspection',
    heading: 'About this inspection',
    group: 'Introduction',
    keywords: ['inspection', 'survey date', 'weather', 'access', 'limitations'],
  },
  {
    key: 'overall_opinion',
    heading: 'Overall opinion',
    group: 'Introduction',
    keywords: ['overall', 'summary', 'opinion', 'condition rating'],
  },
  {
    key: 'about_property',
    heading: 'About the property',
    group: 'Introduction',
    keywords: [
      'property',
      'dwelling',
      'construction',
      'age',
      'tenure',
      'accommodation',
    ],
  },
  {
    key: 'chimney_stacks',
    heading: 'Chimney stacks',
    group: 'Outside',
    keywords: ['chimney', 'stack', 'flaunching', 'pot', 'flashing'],
  },
  {
    key: 'roof_coverings',
    heading: 'Roof coverings',
    group: 'Outside',
    keywords: ['roof', 'tile', 'slate', 'covering', 'ridge', 'valley'],
  },
  {
    key: 'rainwater',
    heading: 'Rainwater pipes and gutters',
    group: 'Outside',
    keywords: ['gutter', 'downpipe', 'rainwater', 'hopper'],
  },
  {
    key: 'main_walls',
    heading: 'Main walls',
    group: 'Outside',
    keywords: ['wall', 'brick', 'render', 'pointing', 'damp proof', 'cavity'],
  },
  {
    key: 'windows',
    heading: 'Windows',
    group: 'Outside',
    keywords: [
      'window',
      'windows',
      'glazing',
      'sash',
      'casement',
      'double glazed',
      'cill',
      'window cill',
    ],
  },
  {
    key: 'outside_doors',
    heading: 'Outside doors',
    group: 'Outside',
    keywords: ['door', 'patio', 'french door', 'threshold'],
  },
  {
    key: 'conservatory_porches',
    heading: 'Conservatory and porches',
    group: 'Outside',
    keywords: ['conservatory', 'porch', 'canopy'],
  },
  {
    key: 'other_joinery',
    heading: 'Other joinery and finishes',
    group: 'Outside',
    keywords: ['fascia', 'soffit', 'bargeboard', 'cladding', 'joinery'],
  },
  {
    key: 'roof_structure',
    heading: 'Roof structure',
    group: 'Inside',
    keywords: ['roof structure', 'rafter', 'truss', 'loft', 'felt'],
  },
  {
    key: 'ceilings',
    heading: 'Ceilings',
    group: 'Inside',
    keywords: ['ceiling', 'plasterboard', 'lath and plaster'],
  },
  {
    key: 'walls_partitions',
    heading: 'Walls and partitions',
    group: 'Inside',
    keywords: ['partition', 'internal wall', 'plaster', 'lining'],
  },
  {
    key: 'floors',
    heading: 'Floors',
    group: 'Inside',
    keywords: ['floor', 'joist', 'screed', 'board', 'deflection'],
  },
  {
    key: 'fireplaces',
    heading: 'Fireplaces, chimney breasts and flues',
    group: 'Inside',
    keywords: ['fireplace', 'hearth', 'flue', 'chimney breast'],
  },
  {
    key: 'built_in_fittings',
    heading: 'Built-in fittings',
    group: 'Inside',
    keywords: [
      'fitted kitchen',
      'fitted',
      'cupboard',
      'wardrobe',
      'kitchen unit',
    ],
  },
  {
    key: 'woodwork',
    heading: 'Woodwork',
    group: 'Inside',
    keywords: ['staircase', 'banister', 'skirting', 'door lining', 'woodwork'],
  },
  {
    key: 'bathroom_fittings',
    heading: 'Bathroom fittings',
    group: 'Inside',
    keywords: ['bathroom', 'wc', 'basin', 'bath', 'shower', 'sanitary'],
  },
  {
    key: 'electricity',
    heading: 'Electricity',
    group: 'Services',
    keywords: ['electric', 'consumer unit', 'fuse', 'socket', 'wiring', 'rcd'],
  },
  {
    key: 'gas_oil',
    heading: 'Gas / oil',
    group: 'Services',
    keywords: ['gas', 'oil', 'meter', 'boiler flue'],
  },
  {
    key: 'water',
    heading: 'Water',
    group: 'Services',
    keywords: ['water', 'stopcock', 'rising main', 'pipework'],
  },
  {
    key: 'heating',
    heading: 'Heating',
    group: 'Services',
    keywords: ['heating', 'boiler', 'radiator', 'thermostat', 'heat pump'],
  },
  {
    key: 'water_heating',
    heading: 'Water heating',
    group: 'Services',
    keywords: ['hot water', 'cylinder', 'immersion', 'combi'],
  },
  {
    key: 'drainage',
    heading: 'Drainage',
    group: 'Services',
    keywords: ['drain', 'soil stack', 'manhole', 'foul', 'surface water'],
  },
  {
    key: 'grounds',
    heading: 'Grounds',
    group: 'Grounds',
    keywords: ['garden', 'grounds', 'drive', 'path', 'boundary', 'fence'],
  },
  {
    key: 'garage_outbuildings',
    heading: 'Garage and outbuildings',
    group: 'Grounds',
    keywords: ['garage', 'outbuilding', 'shed', 'store'],
  },
  {
    key: 'legal_advisers',
    heading: 'Issues for your legal advisers',
    group: 'Back matter',
    keywords: ['legal', 'easement', 'covenant', 'planning', 'guarantee'],
  },
  {
    key: 'risks',
    heading: 'Risks',
    group: 'Back matter',
    keywords: ['risk', 'asbestos', 'radon', 'flood', 'safety'],
  },
  {
    key: 'energy',
    heading: 'Energy efficiency',
    group: 'Back matter',
    keywords: ['energy', 'epc', 'insulation', 'efficiency'],
  },
  {
    key: 'declaration',
    heading: "Surveyor's declaration",
    group: 'Back matter',
    keywords: ['declaration', 'rics', 'surveyor', 'signed'],
  },
  {
    key: 'what_to_do_now',
    heading: 'What to do now',
    group: 'Back matter',
    keywords: ['next steps', 'what to do', 'further investigation'],
  },
  {
    key: 'rics_description',
    heading: 'Description of the RICS Home Survey',
    group: 'Back matter',
    keywords: ['rics home survey', 'level 2', 'level 3', 'boilerplate'],
  },
] as const;

export type BuildingSurveySectionKey =
  (typeof BUILDING_SURVEY_SECTIONS)[number]['key'];

export function buildingSurveySectionByKey(
  key: string,
): BuildingSurveySection | undefined {
  return BUILDING_SURVEY_SECTIONS.find((section) => section.key === key);
}

export function buildingSurveyBlankHtml(): string {
  return BUILDING_SURVEY_SECTIONS.map(
    (section) =>
      `<h2 data-section="${section.key}">${escapeHtml(section.heading)}</h2>\n<p></p>`,
  ).join('\n');
}

export function buildingSurveySectionListForPrompt(): string {
  return BUILDING_SURVEY_SECTIONS.map(
    (section, index) => `${index + 1}. ${section.heading} (${section.key})`,
  ).join('\n');
}

export type SurveyObservationDraft = {
  sectionKey: string;
  body: string;
  sortOrder: number;
};

export type SurveyObservationInput = {
  sectionKey: string;
  body: string;
};

export type SurveyPinnedPhotoInput = {
  sectionKey: string;
  title: string;
  caption?: string | null;
};

export function splitTranscriptParagraphs(transcript: string): string[] {
  return transcript
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
}

export function bestSectionKeyForText(text: string): string {
  const lower = text.toLowerCase();
  let bestKey = 'overall_opinion';
  let bestScore = 0;

  for (const section of BUILDING_SURVEY_SECTIONS) {
    let score = 0;
    for (const keyword of section.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = section.key;
    }
  }

  return bestKey;
}

/**
 * Split a transcript into editable observations and assign each to a section.
 */
export function observationsFromTranscript(
  transcript: string,
): SurveyObservationDraft[] {
  return splitTranscriptParagraphs(transcript).map((body, index) => ({
    sectionKey: bestSectionKeyForText(body),
    body,
    sortOrder: index,
  }));
}

/**
 * Overlay AI (or surveyor) section keys onto already-split paragraphs.
 * Unknown keys fall back to keyword routing for that paragraph.
 */
export function applyObservationSectionKeys(
  paragraphs: string[],
  assignments: Array<{ index: number; sectionKey: string }>,
): SurveyObservationDraft[] {
  const byIndex = new Map<number, string>();
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment.index)) continue;
    if (!buildingSurveySectionByKey(assignment.sectionKey)) continue;
    byIndex.set(assignment.index, assignment.sectionKey);
  }

  return paragraphs.map((body, index) => ({
    sectionKey: byIndex.get(index) ?? bestSectionKeyForText(body),
    body,
    sortOrder: index,
  }));
}

/**
 * Route transcript paragraphs into section keys using keyword scores.
 * Used when the LLM path is unavailable, and as a safety net after generation.
 */
export function routeTranscriptToSections(
  transcript: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const section of BUILDING_SURVEY_SECTIONS) {
    result[section.key] = '';
  }

  for (const observation of observationsFromTranscript(transcript)) {
    const existing = result[observation.sectionKey] ?? '';
    result[observation.sectionKey] = existing
      ? `${existing}\n\n${observation.body}`
      : observation.body;
  }

  return result;
}

export function htmlFromRoutedSections(routed: Record<string, string>): string {
  return htmlFromObservations(
    BUILDING_SURVEY_SECTIONS.flatMap((section) => {
      const body = routed[section.key]?.trim();
      return body ? [{ sectionKey: section.key, body }] : [];
    }),
  );
}

export function htmlFromObservations(
  observations: SurveyObservationInput[],
  photos: SurveyPinnedPhotoInput[] = [],
): string {
  return BUILDING_SURVEY_SECTIONS.map((section) => {
    const bodies = observations
      .filter((item) => item.sectionKey === section.key)
      .map((item) => item.body.trim())
      .filter(Boolean);
    const sectionPhotos = photos.filter(
      (photo) => photo.sectionKey === section.key,
    );

    const paragraphs = [
      ...bodies.map((block) =>
        block
          .split(/\n{2,}/)
          .map((part) => `<p>${escapeHtml(part)}</p>`)
          .join('\n'),
      ),
      ...sectionPhotos.map((photo) => {
        const caption = photo.caption?.trim();
        const label = caption ? `${photo.title} — ${caption}` : photo.title;
        return `<p><em>Photo: ${escapeHtml(label)}</em></p>`;
      }),
    ]
      .filter(Boolean)
      .join('\n');

    return `<h2 data-section="${section.key}">${escapeHtml(section.heading)}</h2>\n${
      paragraphs || '<p></p>'
    }`;
  }).join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
