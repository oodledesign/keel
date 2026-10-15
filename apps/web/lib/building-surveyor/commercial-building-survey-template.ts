/**
 * Commercial building survey system template (Parts A–E).
 * Structure follows a typical commercial condition report shell.
 */
import type {
  SurveyTemplateBlock,
  SurveyTemplateDefinition,
} from './survey-template';

function block(
  id: string,
  kind: SurveyTemplateBlock['kind'],
  extra: Omit<SurveyTemplateBlock, 'id' | 'kind'> = {},
): SurveyTemplateBlock {
  return { id, kind, ...extra };
}

function divider(
  letter: string,
  title: string,
  blurb = '',
): SurveyTemplateBlock {
  return block(`div-${letter.toLowerCase()}`, 'section_divider', {
    letter,
    title,
    ...(blurb ? { staticHtml: `<p>${blurb}</p>` } : {}),
  });
}

function staticPart(
  id: string,
  title: string,
  html: string,
): SurveyTemplateBlock {
  return block(id, 'static_html', {
    title,
    staticHtml: html,
  });
}

function contentSection(
  id: string,
  sectionKey: string,
  title: string,
  letter: string,
): SurveyTemplateBlock {
  return block(id, 'element', {
    letter,
    sectionKey,
    title,
    ricsCode: sectionKey,
    slots: [
      { type: 'content', path: `element:${sectionKey}` },
      { type: 'photos', path: `element:${sectionKey}` },
    ],
  });
}

const COMMERCIAL_BLOCKS: SurveyTemplateBlock[] = [
  block('cover', 'cover', {
    title: 'Commercial Building Survey',
    slots: [
      { type: 'merge', path: 'property.address' },
      { type: 'merge', path: 'client.name' },
      { type: 'merge', path: 'survey.date' },
    ],
  }),
  block('toc', 'toc', { title: 'Contents' }),
  block('report-details', 'form_fields', {
    title: 'Report details',
    slots: [
      { type: 'merge', path: 'property.address' },
      { type: 'merge', path: 'client.name' },
      { type: 'merge', path: 'survey.reference' },
      { type: 'merge', path: 'surveyor.name' },
    ],
  }),

  divider(
    'A',
    'Part A — Preambles',
    'Instructions, limitations and basis of report.',
  ),
  staticPart(
    'part-a-instructions',
    'Instructions',
    '<p>This commercial building survey was prepared in accordance with the client’s instructions and the agreed scope of inspection.</p>',
  ),
  staticPart(
    'part-a-limitations',
    'Limitations',
    '<p>The inspection was non-intrusive. Concealed parts of the structure and services were not opened up unless specifically noted.</p>',
  ),
  contentSection(
    'part-a-scope',
    'about_inspection',
    'Scope of inspection',
    'A',
  ),

  divider(
    'B',
    'Part B — Executive summary',
    'Principal findings and priorities.',
  ),
  contentSection(
    'part-b-overall',
    'overall_opinion',
    'Overall condition summary',
    'B',
  ),
  contentSection('part-b-structure', 'main_walls', 'Structure and fabric', 'B'),
  contentSection('part-b-roof', 'roof_coverings', 'Roof and coverings', 'B'),
  contentSection('part-b-services', 'electricity', 'Services overview', 'B'),
  contentSection(
    'part-b-grounds',
    'grounds',
    'External areas and grounds',
    'B',
  ),

  divider(
    'C',
    'Part C — Statutory and compliance',
    'Fire, access and regulatory matters.',
  ),
  contentSection(
    'part-c-fire',
    'other_outside',
    'Fire safety observations',
    'C',
  ),
  contentSection(
    'part-c-access',
    'location',
    'Access and means of escape',
    'C',
  ),
  staticPart(
    'part-c-disclaimer',
    'Statutory disclaimer',
    '<p>This part records observations only. It is not a fire risk assessment, accessibility audit, or formal compliance certificate.</p>',
  ),

  divider('D', 'Part D — Services', 'Mechanical and electrical overview.'),
  contentSection(
    'part-d-electrical',
    'electricity',
    'Electrical installation',
    'D',
  ),
  contentSection('part-d-heating', 'heating', 'Heating and hot water', 'D'),
  contentSection('part-d-water', 'water', 'Water and drainage', 'D'),
  staticPart(
    'part-d-boilerplate',
    'Services note',
    '<p>Service installations were inspected visually. Specialist testing was not undertaken unless separately instructed.</p>',
  ),

  divider(
    'E',
    'Part E — Photographic schedule',
    'Photographs taken during the inspection.',
  ),
  block('part-e-photos', 'boilerplate', {
    letter: 'E',
    title: 'Photographic schedule',
    slots: [{ type: 'photos', path: 'schedule:all' }],
    staticHtml:
      '<p>Photographs are scheduled by section. Captions reflect site notes at the time of inspection.</p>',
  }),
];

export const COMMERCIAL_BUILDING_SURVEY_TEMPLATE: SurveyTemplateDefinition = {
  key: 'commercial_building_survey',
  name: 'Commercial building survey',
  surveyType: 'commercial_building_survey',
  brand: {
    primaryColor: '#1F3A5F',
    footerLabel: 'Commercial Building Survey',
    showRicsLogo: true,
  },
  surveyorDefaults: {},
  blocks: COMMERCIAL_BLOCKS,
  notes:
    'Commercial condition report shell (Parts A–E). Map leads with survey type commercial_condition onto this template.',
};

export const COMMERCIAL_SECTION_AI_HINTS: Record<string, string> = {
  about_inspection:
    'Record access, weather, occupancy and any inspection limitations for a commercial premises.',
  overall_opinion:
    'Summarise the overall condition and the most significant defects or risks.',
  main_walls:
    'Describe structural and fabric condition of walls and frame as visible.',
  roof_coverings:
    'Describe roof coverings, flashings and rainwater goods from available vantage points.',
  electricity:
    'Note visible electrical distribution, boards and any obvious defects. Do not claim testing.',
  heating:
    'Note heating plant and distribution as visible; flag age and maintenance clues.',
  water:
    'Note visible water and drainage arrangements and any leakage or corrosion.',
  grounds: 'Describe external areas, parking, paving and boundary condition.',
  location:
    'Summarise site context, access and neighbouring uses relevant to condition.',
  other_outside:
    'Record fire safety and external compliance observations without issuing a FRA.',
};

/** Lead survey_type → system template key. */
export function templateKeyForSurveyType(
  surveyType: string | null | undefined,
): 'rics_hss_l2' | 'rics_hss_l3' | 'commercial_building_survey' {
  if (surveyType === 'rics_hss_l3') return 'rics_hss_l3';
  if (
    surveyType === 'commercial_condition' ||
    surveyType === 'commercial_building_survey'
  ) {
    return 'commercial_building_survey';
  }
  return 'rics_hss_l2';
}
