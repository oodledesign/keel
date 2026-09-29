import { BUILDING_SURVEY_SECTIONS } from './rics-catalogue';
import {
  CLOSING_CALLOUTS,
  CONTENTS_NOTICE,
  DIVIDER_BLURBS,
  ENERGY_EFFICIENCY_INTRO,
  FLATS_NOTE,
  LIMITATIONS_DEFAULTS,
  REMINDER_CALLOUT,
  SAFETY_WARNINGS,
  TYPICAL_HOUSE_HTML,
  type TemplateLevel,
  WHAT_TO_DO_NOW_HTML,
  aboutTheSurveyHtml,
  serviceDescriptionHtml,
} from './survey-template-wording';

export const SURVEY_SYSTEM_TEMPLATE_KEYS = [
  'rics_hss_l3',
  'rics_hss_l2',
] as const;

export type SurveySystemTemplateKey =
  (typeof SURVEY_SYSTEM_TEMPLATE_KEYS)[number];

export const SURVEY_TEMPLATE_BLOCK_KINDS = [
  'cover',
  'toc',
  'section_divider',
  'subsection',
  'static_html',
  'callout',
  'merge_fields',
  'form_fields',
  'fields',
  'opinion',
  'documents_table',
  'rating_summary',
  'repairs_summary',
  'property_fields',
  'accommodation_matrix',
  'services_grid',
  'element',
  'legal_sub',
  'risks_sub',
  'energy_sub',
  'declaration',
  'boilerplate',
  'diagram',
] as const;

export type SurveyTemplateBlockKind =
  (typeof SURVEY_TEMPLATE_BLOCK_KINDS)[number];

export const SURVEY_TEMPLATE_SLOT_TYPES = [
  'merge',
  'content',
  'photos',
  'rating',
  'table',
  'accommodation',
  'services',
  'documents',
  'repairs',
  'qualifications',
] as const;

export type SurveyTemplateSlot = {
  type: (typeof SURVEY_TEMPLATE_SLOT_TYPES)[number];
  path: string;
};

export type SurveyTemplateBrand = {
  primaryColor: string;
  footerLabel: string;
  logoUrl?: string;
  coverHeroUrl?: string;
  /** Show the RICS logo on the cover and section dividers (licensed firms). */
  showRicsLogo?: boolean;
};

/** Property type a block applies to; omitted means every property. */
export type SurveyTemplateAudience = 'flat' | 'house';

export type SurveyTemplateBlock = {
  id: string;
  kind: SurveyTemplateBlockKind;
  letter?: string;
  ricsCode?: string;
  sectionKey?: string;
  title?: string;
  staticHtml?: string;
  slots?: SurveyTemplateSlot[];
  showWhen?: SurveyTemplateAudience;
  levels?: TemplateLevel[];
};

export type SurveyTemplateDefinition = {
  key: SurveySystemTemplateKey;
  name: string;
  surveyType: SurveySystemTemplateKey;
  brand: SurveyTemplateBrand;
  surveyorDefaults: Record<string, string>;
  blocks: SurveyTemplateBlock[];
  /** Editorial notes shown to template editors. */
  notes?: string;
};

export type SurveyTemplateRecord = {
  id: string;
  accountId: string;
  systemKey: SurveySystemTemplateKey;
  surveyType: SurveySystemTemplateKey;
  name: string;
  isDefault: boolean;
  brand: SurveyTemplateBrand;
  surveyorDefaults: Record<string, string>;
  blocks: SurveyTemplateBlock[];
  sourceSystemKey: SurveySystemTemplateKey;
  updatedAt: string;
};

function block(
  id: string,
  kind: SurveyTemplateBlockKind,
  extra: Omit<SurveyTemplateBlock, 'id' | 'kind'> = {},
): SurveyTemplateBlock {
  return { id, kind, ...extra };
}

function letterDivider(
  letter: string,
  title: string,
  blurbHtml = '',
): SurveyTemplateBlock {
  return block(`div-${letter.toLowerCase()}`, 'section_divider', {
    letter,
    title,
    ...(blurbHtml ? { staticHtml: blurbHtml } : {}),
  });
}

function contentFields(
  id: string,
  letter: string,
  codes: string[],
  extra: Omit<SurveyTemplateBlock, 'id' | 'kind'> = {},
): SurveyTemplateBlock {
  return block(id, 'fields', {
    letter,
    slots: codes.map((code) => ({ type: 'content', path: `element:${code}` })),
    ...extra,
  });
}

function elementBlock(
  ricsCode: string,
  sectionKey: string,
): SurveyTemplateBlock {
  return block(`el-${ricsCode.toLowerCase()}`, 'element', {
    ricsCode,
    sectionKey,
    letter: ricsCode.charAt(0),
    slots: [
      { type: 'photos', path: `element:${ricsCode}` },
      { type: 'rating', path: ricsCode },
      { type: 'content', path: `element:${ricsCode}` },
    ],
  });
}

const ELEMENTS: Array<[string, string]> = [
  ['D1', 'chimney_stacks'],
  ['D2', 'roof_coverings'],
  ['D3', 'rainwater'],
  ['D4', 'main_walls'],
  ['D5', 'windows'],
  ['D6', 'outside_doors'],
  ['D7', 'conservatory_porches'],
  ['D8', 'other_joinery'],
  ['D9', 'other_outside'],
  ['E1', 'roof_structure'],
  ['E2', 'ceilings'],
  ['E3', 'walls_partitions'],
  ['E4', 'floors'],
  ['E5', 'fireplaces'],
  ['E6', 'built_in_fittings'],
  ['E7', 'woodwork'],
  ['E8', 'bathroom_fittings'],
  ['E9', 'other_inside'],
  ['F1', 'electricity'],
  ['F2', 'gas_oil'],
  ['F3', 'water'],
  ['F4', 'heating'],
  ['F5', 'water_heating'],
  ['F6', 'drainage'],
  ['F7', 'common_services'],
  ['G1', 'garage_outbuildings'],
  ['G2', 'permanent_outbuildings'],
  ['G3', 'grounds'],
];

const H_SUBS: Array<[string, string]> = [
  ['H1', 'legal_advisers'],
  ['H2', 'legal_guarantees'],
  ['H3', 'legal_other'],
];

const I_SUBS: Array<[string, string]> = [
  ['I1', 'risks'],
  ['I2', 'risks_grounds'],
  ['I3', 'risks_people'],
  ['I4', 'risks_other'],
];

const J_SUBS: Array<[string, string]> = [
  ['J1', 'energy'],
  ['J2', 'energy_heating'],
  ['J3', 'energy_lighting'],
  ['J4', 'energy_ventilation'],
  ['J5', 'energy_general'],
];

const MERGE_SLOTS: SurveyTemplateSlot[] = [
  { type: 'merge', path: 'property.address' },
  { type: 'merge', path: 'client.name' },
  { type: 'merge', path: 'inspection.date' },
  { type: 'merge', path: 'report.producedDate' },
  { type: 'merge', path: 'report.reference' },
  { type: 'merge', path: 'surveyor.name' },
  { type: 'merge', path: 'surveyor.ricsNumber' },
  { type: 'merge', path: 'company.name' },
];

const SAFETY_WARNING_AFTER: Record<string, string> = {
  F1: SAFETY_WARNINGS.F1,
  F2: SAFETY_WARNINGS.F2,
};

function frontMatter(level: TemplateLevel): SurveyTemplateBlock[] {
  return [
    block('cover', 'cover', {
      title: `RICS Home Survey – Level ${level}`,
      slots: MERGE_SLOTS,
      staticHtml:
        '<p>Your survey report</p><p>{{property.address}}</p><p>Prepared for {{client.name}}</p>',
    }),
    block('toc', 'toc', {
      title: 'Contents',
      staticHtml: CONTENTS_NOTICE(level),
    }),
    letterDivider('A', 'About the inspection', DIVIDER_BLURBS.A(level)),
    block('a-about', 'static_html', {
      letter: 'A',
      staticHtml: aboutTheSurveyHtml(level),
    }),
    block('a-reminder', 'callout', {
      letter: 'A',
      staticHtml: REMINDER_CALLOUT,
    }),
    block('a-fields', 'fields', {
      letter: 'A',
      slots: [
        { type: 'merge', path: 'surveyor.name' },
        { type: 'merge', path: 'surveyor.ricsNumber' },
        { type: 'merge', path: 'company.name' },
        { type: 'content', path: 'element:A.related_party' },
        { type: 'merge', path: 'property.address' },
        { type: 'content', path: 'element:A.weather' },
        { type: 'content', path: 'element:A.occupancy' },
        { type: 'merge', path: 'inspection.date' },
        { type: 'merge', path: 'report.reference' },
      ],
    }),
    letterDivider('B', 'Overall opinion', DIVIDER_BLURBS.B()),
    block('b-opinion', 'opinion', {
      letter: 'B',
      title: 'Overall opinion of property',
      sectionKey: 'overall_opinion',
      slots: [{ type: 'content', path: 'overall_opinion' }],
    }),
    block('b-documents', 'documents_table', {
      letter: 'B',
      sectionKey: 'documents_suggested',
      slots: [{ type: 'documents', path: 'element:B.documents' }],
    }),
    block('b-ratings', 'rating_summary', {
      letter: 'B',
      slots: [{ type: 'table', path: 'rating_summary' }],
    }),
    block('b-repairs', 'repairs_summary', {
      letter: 'B',
      sectionKey: 'repairs_summary',
      slots: [
        { type: 'repairs', path: 'element:B.repairs' },
        { type: 'content', path: 'element:B.further_investigations' },
      ],
    }),
    letterDivider('C', 'About the property', DIVIDER_BLURBS.C()),
    block('c-sub-property', 'subsection', {
      letter: 'C',
      title: 'About the property',
    }),
    contentFields('c-fields', 'C', [
      'C.type',
      'C.year_built',
      'C.year_extended',
      'C.year_converted',
      'C.flats',
      'C.construction',
    ]),
    block('c-flats', 'callout', {
      letter: 'C',
      showWhen: 'flat',
      staticHtml: FLATS_NOTE,
    }),
    block('c-acc', 'accommodation_matrix', {
      letter: 'C',
      title: 'Accommodation',
      slots: [{ type: 'accommodation', path: 'accommodation' }],
    }),
    contentFields('c-escape', 'C', ['C.means_of_escape'], { levels: [3] }),
    block('c-sub-energy', 'subsection', {
      letter: 'C',
      title: 'Energy efficiency',
    }),
    block('c-energy-intro', 'static_html', {
      letter: 'C',
      staticHtml: ENERGY_EFFICIENCY_INTRO(level),
    }),
    contentFields('c-epc', 'C', ['C.epc', 'C.epc_issues']),
    block('c-services', 'services_grid', {
      letter: 'C',
      slots: [{ type: 'services', path: 'services' }],
    }),
    contentFields('c-energy-other', 'C', [
      'C.other_energy_sources',
      'C.other_energy',
    ]),
    block('c-sub-location', 'subsection', {
      letter: 'C',
      title: 'Location and facilities',
    }),
    contentFields('c-location', 'C', [
      'C.grounds',
      'C.location',
      'C.facilities',
      'C.local_environment',
      'C.other_local',
    ]),
  ];
}

function elementSection(
  letter: 'D' | 'E' | 'F' | 'G',
  title: string,
  blurbHtml: string,
  limitationsKey: string,
): SurveyTemplateBlock[] {
  return [
    letterDivider(letter, title, blurbHtml),
    block(`${letter.toLowerCase()}-lim`, 'static_html', {
      letter,
      ricsCode: `${letter}.limitations`,
      sectionKey: limitationsKey,
      title: 'Limitations on the inspection',
      staticHtml: LIMITATIONS_DEFAULTS[letter],
      slots: [{ type: 'content', path: `element:${letter}.limitations` }],
    }),
    ...ELEMENTS.filter(([code]) => code.startsWith(letter)).flatMap(
      ([code, key]) => [
        elementBlock(code, key),
        ...(SAFETY_WARNING_AFTER[code]
          ? [
              block(`${code.toLowerCase()}-warning`, 'callout', {
                letter,
                staticHtml: SAFETY_WARNING_AFTER[code],
              }),
            ]
          : []),
      ],
    ),
  ];
}

function backMatter(level: TemplateLevel): SurveyTemplateBlock[] {
  return [
    letterDivider('H', 'Issues for your legal advisers', DIVIDER_BLURBS.H()),
    ...H_SUBS.map(([code, key]) =>
      block(`h-${code.toLowerCase()}`, 'legal_sub', {
        ricsCode: code,
        sectionKey: key,
        slots: [{ type: 'content', path: `element:${code}` }],
      }),
    ),
    letterDivider('I', 'Risks', DIVIDER_BLURBS.I()),
    ...I_SUBS.map(([code, key]) =>
      block(`i-${code.toLowerCase()}`, 'risks_sub', {
        ricsCode: code,
        sectionKey: key,
        slots: [{ type: 'content', path: `element:${code}` }],
      }),
    ),
    ...(level === 3
      ? [
          letterDivider('J', 'Energy matters', DIVIDER_BLURBS.J()),
          ...J_SUBS.map(([code, key]) =>
            block(`j-${code.toLowerCase()}`, 'energy_sub', {
              ricsCode: code,
              sectionKey: key,
              slots: [{ type: 'content', path: `element:${code}` }],
            }),
          ),
        ]
      : [
          letterDivider('J', 'Valuation', DIVIDER_BLURBS.JValuation()),
          contentFields('j-valuation', 'J', ['J.valuation'], {
            ricsCode: 'J.valuation',
            sectionKey: 'valuation',
          }),
        ]),
    letterDivider('K', "Surveyor's declaration"),
    block('k-declaration', 'declaration', {
      letter: 'K',
      sectionKey: 'declaration',
      slots: [
        { type: 'merge', path: 'surveyor.name' },
        { type: 'merge', path: 'surveyor.ricsNumber' },
        { type: 'merge', path: 'company.name' },
        { type: 'merge', path: 'surveyor.address' },
        { type: 'qualifications', path: 'surveyor.qualifications' },
        { type: 'merge', path: 'surveyor.phone' },
        { type: 'merge', path: 'surveyor.email' },
        { type: 'merge', path: 'surveyor.website' },
        { type: 'merge', path: 'property.address' },
        { type: 'merge', path: 'client.name' },
        { type: 'merge', path: 'report.producedDate' },
      ],
      staticHtml:
        '<p>I confirm that I have inspected the property and prepared this report.</p>',
    }),
    letterDivider('L', 'What to do now'),
    block('l-boilerplate', 'boilerplate', {
      letter: 'L',
      sectionKey: 'what_to_do_now',
      staticHtml: WHAT_TO_DO_NOW_HTML,
    }),
    letterDivider(
      'M',
      `Description of the RICS Home Survey - Level ${level} service and terms of engagement`,
    ),
    block('m-boilerplate', 'boilerplate', {
      letter: 'M',
      sectionKey: 'rics_description',
      staticHtml: serviceDescriptionHtml(level),
    }),
    letterDivider('N', 'Typical house diagram'),
    block('n-diagram', 'diagram', {
      letter: 'N',
      sectionKey: 'typical_house_diagram',
      staticHtml: TYPICAL_HOUSE_HTML,
      slots: [{ type: 'photos', path: 'element:N' }],
    }),
    block('n-closing', 'static_html', {
      letter: 'N',
      staticHtml: CLOSING_CALLOUTS,
    }),
  ];
}

function ricsTemplateBlocks(level: TemplateLevel): SurveyTemplateBlock[] {
  return [
    ...frontMatter(level),
    ...elementSection('D', 'Outside the property', '', 'outside_limitations'),
    ...elementSection('E', 'Inside the property', '', 'inside_limitations'),
    ...elementSection(
      'F',
      'Services',
      DIVIDER_BLURBS.F(),
      'services_limitations',
    ),
    ...elementSection(
      'G',
      'Grounds (including shared areas for flats)',
      '',
      'grounds_limitations',
    ),
    ...backMatter(level),
  ];
}

export const RICS_HSS_L3_TEMPLATE: SurveyTemplateDefinition = {
  key: 'rics_hss_l3',
  name: 'RICS Home Survey Level 3',
  surveyType: 'rics_hss_l3',
  brand: {
    primaryColor: '#4A2C6A',
    footerLabel: 'RICS Home Survey - Level 3',
    showRicsLogo: true,
  },
  surveyorDefaults: {},
  blocks: ricsTemplateBlocks(3),
};

export const RICS_HSS_L2_TEMPLATE: SurveyTemplateDefinition = {
  key: 'rics_hss_l2',
  name: 'RICS Home Survey Level 2',
  surveyType: 'rics_hss_l2',
  brand: {
    primaryColor: '#4A2C6A',
    footerLabel: 'RICS Home Survey - Level 2',
    showRicsLogo: true,
  },
  surveyorDefaults: {},
  blocks: ricsTemplateBlocks(2),
  notes:
    'Level 2 wording is derived from the Level 3 form and has not yet been checked against a licensed Level 2 report.',
};

export const SYSTEM_SURVEY_TEMPLATES: Record<
  SurveySystemTemplateKey,
  SurveyTemplateDefinition
> = {
  rics_hss_l3: RICS_HSS_L3_TEMPLATE,
  rics_hss_l2: RICS_HSS_L2_TEMPLATE,
};

export function systemSurveyTemplate(
  key: string | null | undefined,
): SurveyTemplateDefinition {
  if (key === 'rics_hss_l2') return RICS_HSS_L2_TEMPLATE;
  return RICS_HSS_L3_TEMPLATE;
}

export function templateLevel(
  template: Pick<SurveyTemplateDefinition, 'surveyType'>,
): TemplateLevel {
  return template.surveyType === 'rics_hss_l2' ? 2 : 3;
}

export function isSurveySystemTemplateKey(
  value: string | null | undefined,
): value is SurveySystemTemplateKey {
  return Boolean(
    value &&
    SURVEY_SYSTEM_TEMPLATE_KEYS.includes(value as SurveySystemTemplateKey),
  );
}

export function cloneSystemSurveyTemplate(
  key: SurveySystemTemplateKey,
  name?: string,
): SurveyTemplateDefinition {
  const source = systemSurveyTemplate(key);
  return {
    ...source,
    name: name?.trim() || `${source.name} (workspace)`,
    blocks: source.blocks.map((item) => ({
      ...item,
      slots: item.slots ? [...item.slots] : undefined,
      levels: item.levels ? [...item.levels] : undefined,
    })),
    brand: { ...source.brand },
    surveyorDefaults: { ...source.surveyorDefaults },
  };
}

export function mergeFieldPathsFromTemplate(
  template: SurveyTemplateDefinition,
): string[] {
  const paths = new Set<string>();
  for (const item of template.blocks) {
    for (const slot of item.slots ?? []) {
      if (slot.type === 'merge') paths.add(slot.path);
    }
  }
  return [...paths];
}

export function elementCodesInTemplate(
  template: SurveyTemplateDefinition,
): string[] {
  return template.blocks
    .map((item) => item.ricsCode)
    .filter((code): code is string => Boolean(code));
}

export function catalogueKeysReferencedByTemplate(
  template: SurveyTemplateDefinition,
): string[] {
  const keys = new Set<string>();
  for (const item of template.blocks) {
    if (item.sectionKey) keys.add(item.sectionKey);
  }
  for (const section of BUILDING_SURVEY_SECTIONS) {
    if (template.blocks.some((item) => item.ricsCode === section.ricsCode)) {
      keys.add(section.key);
    }
  }
  return [...keys];
}
