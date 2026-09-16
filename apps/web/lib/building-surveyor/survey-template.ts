import { BUILDING_SURVEY_SECTIONS } from './rics-catalogue';

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
  'static_html',
  'merge_fields',
  'form_fields',
  'opinion',
  'rating_summary',
  'repairs_summary',
  'property_fields',
  'accommodation_matrix',
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

export type SurveyTemplateSlot =
  | { type: 'merge'; path: string }
  | { type: 'content'; path: string }
  | { type: 'photos'; path: string }
  | { type: 'rating'; path: string }
  | { type: 'table'; path: string };

export type SurveyTemplateBrand = {
  primaryColor: string;
  footerLabel: string;
  logoUrl?: string;
  coverHeroUrl?: string;
};

export type SurveyTemplateBlock = {
  id: string;
  kind: SurveyTemplateBlockKind;
  letter?: string;
  ricsCode?: string;
  sectionKey?: string;
  title?: string;
  staticHtml?: string;
  slots?: SurveyTemplateSlot[];
};

export type SurveyTemplateDefinition = {
  key: SurveySystemTemplateKey;
  name: string;
  surveyType: SurveySystemTemplateKey;
  brand: SurveyTemplateBrand;
  surveyorDefaults: Record<string, string>;
  blocks: SurveyTemplateBlock[];
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
  blurb: string,
): SurveyTemplateBlock {
  return block(`div-${letter.toLowerCase()}`, 'section_divider', {
    letter,
    title,
    staticHtml: `<p>${blurb}</p>`,
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

const L3_ELEMENTS: Array<[string, string]> = [
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
  { type: 'merge', path: 'weather' },
  { type: 'merge', path: 'occupancy' },
  { type: 'merge', path: 'surveyor.name' },
  { type: 'merge', path: 'surveyor.ricsNumber' },
  { type: 'merge', path: 'company.name' },
];

function sharedFrontMatter(levelLabel: string): SurveyTemplateBlock[] {
  return [
    block('cover', 'cover', {
      title: levelLabel,
      slots: MERGE_SLOTS,
      staticHtml:
        '<p>Your survey report</p><p>{{property.address}}</p><p>Prepared for {{client.name}}</p>',
    }),
    block('toc', 'toc', {
      title: 'Contents',
      staticHtml:
        '<p>The RICS Home Survey is reproduced with the permission of the Royal Institution of Chartered Surveyors, which owns the copyright. 2021 RICS ©</p>',
    }),
    letterDivider(
      'A',
      'About the inspection',
      'This section records who instructed the survey, when we inspected, and the weather and occupancy at the time.',
    ),
    block('a-fields', 'form_fields', {
      letter: 'A',
      sectionKey: 'about_inspection',
      slots: [
        { type: 'merge', path: 'client.name' },
        { type: 'merge', path: 'property.address' },
        { type: 'merge', path: 'inspection.date' },
        { type: 'merge', path: 'report.reference' },
        { type: 'merge', path: 'weather' },
        { type: 'merge', path: 'occupancy' },
        { type: 'merge', path: 'surveyor.name' },
        { type: 'merge', path: 'surveyor.ricsNumber' },
        { type: 'content', path: 'element:A.related_party' },
      ],
    }),
    letterDivider(
      'B',
      'Overall opinion',
      'This section summarises the condition of the property and highlights repairs and further investigations.',
    ),
    block('b-opinion', 'opinion', {
      letter: 'B',
      sectionKey: 'overall_opinion',
      slots: [{ type: 'content', path: 'overall_opinion' }],
    }),
    block('b-ratings', 'rating_summary', {
      letter: 'B',
      slots: [{ type: 'table', path: 'rating_summary' }],
    }),
    block('b-repairs', 'repairs_summary', {
      letter: 'B',
      sectionKey: 'repairs_summary',
      slots: [
        { type: 'content', path: 'element:B.repairs' },
        { type: 'content', path: 'element:B.further_investigations' },
      ],
    }),
    letterDivider(
      'C',
      'About the property',
      'Type, age, construction, accommodation and the immediate location.',
    ),
    block('c-fields', 'property_fields', {
      letter: 'C',
      sectionKey: 'about_property',
      slots: [
        { type: 'content', path: 'element:C.type' },
        { type: 'content', path: 'element:C.year_built' },
        { type: 'content', path: 'element:C.construction' },
        { type: 'content', path: 'element:C.flats' },
        { type: 'content', path: 'element:C.location' },
      ],
    }),
    block('c-acc', 'accommodation_matrix', {
      letter: 'C',
      slots: [{ type: 'table', path: 'accommodation' }],
    }),
  ];
}

function sharedBackMatter(includeEnergy: boolean): SurveyTemplateBlock[] {
  return [
    letterDivider(
      'H',
      'Issues for your legal advisers',
      'We recommend your legal advisers consider the following matters.',
    ),
    ...H_SUBS.map(([code, key]) =>
      block(`h-${code.toLowerCase()}`, 'legal_sub', {
        ricsCode: code,
        sectionKey: key,
        slots: [{ type: 'content', path: `element:${code}` }],
      }),
    ),
    letterDivider('I', 'Risks', 'Risks to the building, grounds and people.'),
    ...I_SUBS.map(([code, key]) =>
      block(`i-${code.toLowerCase()}`, 'risks_sub', {
        ricsCode: code,
        sectionKey: key,
        slots: [{ type: 'content', path: `element:${code}` }],
      }),
    ),
    ...(includeEnergy
      ? [
          letterDivider(
            'J',
            'Energy matters',
            'Insulation, heating, lighting, ventilation and general energy comments.',
          ),
          ...J_SUBS.map(([code, key]) =>
            block(`j-${code.toLowerCase()}`, 'energy_sub', {
              ricsCode: code,
              sectionKey: key,
              slots: [{ type: 'content', path: `element:${code}` }],
            }),
          ),
        ]
      : [
          letterDivider(
            'J',
            'Valuation',
            'Tenure, area and other considerations affecting value (Level 2).',
          ),
          block('j-valuation', 'form_fields', {
            letter: 'J',
            sectionKey: 'valuation',
            ricsCode: 'J.valuation',
            slots: [{ type: 'content', path: 'element:J.valuation' }],
          }),
        ]),
    letterDivider(
      'K',
      "Surveyor's declaration",
      'I confirm that I have inspected the property and prepared this report.',
    ),
    block('k-declaration', 'declaration', {
      letter: 'K',
      sectionKey: 'declaration',
      slots: MERGE_SLOTS,
      staticHtml:
        '<p>I confirm that I have inspected the property and prepared this report.</p><p>{{surveyor.name}} {{surveyor.ricsNumber}}</p><p>{{company.name}}</p>',
    }),
    letterDivider(
      'L',
      'What to do now',
      'Further investigations and getting quotes.',
    ),
    block('l-boilerplate', 'boilerplate', {
      letter: 'L',
      sectionKey: 'what_to_do_now',
      staticHtml:
        '<p>If we have advised further investigation, obtain quotes from suitable contractors or specialists before you exchange contracts.</p>',
    }),
    letterDivider(
      'M',
      'Description of the RICS Home Survey',
      'Condition rating definitions and the service described by RICS.',
    ),
    block('m-boilerplate', 'boilerplate', {
      letter: 'M',
      sectionKey: 'rics_description',
      staticHtml:
        '<p><strong>Condition rating 1</strong> — No repair is currently needed. Normal maintenance must be carried out.</p><p><strong>Condition rating 2</strong> — Defects that need repairing or replacing but are not considered to be serious or urgent.</p><p><strong>Condition rating 3</strong> — Defects that are serious and/or need to be repaired, replaced or investigated urgently.</p><p>NI — Not inspected. NA — Not applicable.</p>',
    }),
    letterDivider('N', 'Typical house diagram', 'Typical house construction.'),
    block('n-diagram', 'diagram', {
      letter: 'N',
      sectionKey: 'typical_house_diagram',
      slots: [{ type: 'photos', path: 'element:N' }],
    }),
  ];
}

function elementSection(
  letter: string,
  title: string,
  blurb: string,
  codes: Array<[string, string]>,
  limitationsKey: string,
  limitationsCode: string,
): SurveyTemplateBlock[] {
  return [
    letterDivider(letter, title, blurb),
    block(`${letter.toLowerCase()}-lim`, 'static_html', {
      letter,
      ricsCode: limitationsCode,
      sectionKey: limitationsKey,
      staticHtml:
        '<p>We did not inspect parts that were concealed, inaccessible, or would have caused damage. Comments are based on a visual inspection.</p>',
      slots: [{ type: 'content', path: `element:${limitationsCode}` }],
    }),
    ...codes.map(([code, key]) => elementBlock(code, key)),
  ];
}

export const RICS_HSS_L3_TEMPLATE: SurveyTemplateDefinition = {
  key: 'rics_hss_l3',
  name: 'RICS Home Survey Level 3',
  surveyType: 'rics_hss_l3',
  brand: {
    primaryColor: '#4A2C6A',
    footerLabel: 'RICS Home Survey - Level 3',
  },
  surveyorDefaults: {},
  blocks: [
    ...sharedFrontMatter('RICS Home Survey – Level 3'),
    ...elementSection(
      'D',
      'Outside the property',
      'External elements from chimney stacks to other joinery.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('D')),
      'outside_limitations',
      'D.limitations',
    ),
    ...elementSection(
      'E',
      'Inside the property',
      'Internal elements from roof structure to other fittings.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('E')),
      'inside_limitations',
      'E.limitations',
    ),
    ...elementSection(
      'F',
      'Services',
      'Electricity, gas/oil, water, heating, drainage and common services.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('F')),
      'services_limitations',
      'F.limitations',
    ),
    ...elementSection(
      'G',
      'Grounds',
      'Garage, outbuildings and other grounds.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('G')),
      'grounds_limitations',
      'G.limitations',
    ),
    ...sharedBackMatter(true),
  ],
};

export const RICS_HSS_L2_TEMPLATE: SurveyTemplateDefinition = {
  key: 'rics_hss_l2',
  name: 'RICS Home Survey Level 2',
  surveyType: 'rics_hss_l2',
  brand: {
    primaryColor: '#4A2C6A',
    footerLabel: 'RICS Home Survey - Level 2',
  },
  surveyorDefaults: {},
  blocks: [
    ...sharedFrontMatter('RICS Home Survey – Level 2'),
    ...elementSection(
      'D',
      'Outside the property',
      'External elements from chimney stacks to other joinery.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('D')),
      'outside_limitations',
      'D.limitations',
    ),
    ...elementSection(
      'E',
      'Inside the property',
      'Internal elements from roof structure to other fittings.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('E')),
      'inside_limitations',
      'E.limitations',
    ),
    ...elementSection(
      'F',
      'Services',
      'Electricity, gas/oil, water, heating, drainage and common services.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('F')),
      'services_limitations',
      'F.limitations',
    ),
    ...elementSection(
      'G',
      'Grounds',
      'Garage, outbuildings and other grounds.',
      L3_ELEMENTS.filter(([code]) => code.startsWith('G')),
      'grounds_limitations',
      'G.limitations',
    ),
    ...sharedBackMatter(false),
  ],
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
