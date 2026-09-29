import type { ConditionRating } from './condition-rating';
import { CONDITION_RATING_COLORS } from './condition-rating';
import {
  buildingSurveySectionByKey,
  buildingSurveySectionByRicsCode,
  surveySectionDisplayLabel,
} from './rics-catalogue';
import {
  ACCOMMODATION_FLOORS,
  ACCOMMODATION_ROOMS,
  CENTRAL_HEATING,
  MAIN_SERVICES,
  type SurveyAccommodation,
  type SurveyServices,
  type SurveyorQualification,
  accommodationHasCounts,
} from './survey-report-details';
import {
  type SurveyReportBlock,
  type SurveyReportDocument,
  createSurveyReportBlockId,
  paragraphsToHtml,
} from './survey-report-document';
import { SURVEY_SECTION_CATALOGUE } from './survey-section-catalogue';
import {
  type SurveyTemplateBlock,
  type SurveyTemplateDefinition,
  templateLevel,
} from './survey-template';
import {
  DOCUMENTS_INTRO,
  FURTHER_INVESTIGATIONS_INTRO,
  RATING_INTRO,
  REPAIRS_INTRO,
} from './survey-template-wording';

export type SurveyMergeValues = Record<string, string | null | undefined>;

export type SurveySlotObservation = {
  sectionKey: string;
  ricsCode?: string | null;
  body: string;
  conditionRating?: ConditionRating | null;
};

export type SurveySlotPhoto = {
  sectionKey: string;
  ricsCode?: string | null;
  title: string;
  caption?: string | null;
  documentId?: string;
  url?: string | null;
};

export type SurveyStructuredValues = {
  accommodation?: SurveyAccommodation | null;
  services?: SurveyServices | null;
  qualifications?: SurveyorQualification[];
};

export type AssembleSurveyTemplateInput = {
  template: SurveyTemplateDefinition;
  merge: SurveyMergeValues;
  observations: SurveySlotObservation[];
  photos?: SurveySlotPhoto[];
  sectionHtml?: Record<string, string>;
  structured?: SurveyStructuredValues;
};

type HeadingBlock = Extract<SurveyReportBlock, { type: 'heading' }>;

export const SURVEY_FIELD_LABELS: Record<string, string> = {
  'client.name': "Client's name",
  'property.address': 'Full address and postcode of the property',
  'inspection.date': 'Date of the inspection',
  'report.producedDate': 'Date this report was produced',
  'report.reference': 'Report reference',
  weather: 'Weather conditions when the inspection took place',
  occupancy: 'Status of the property when the inspection took place',
  'surveyor.name': "Surveyor's name",
  'surveyor.ricsNumber': "Surveyor's RICS number",
  'surveyor.address': "Surveyor's address",
  'surveyor.phone': 'Phone number',
  'surveyor.email': 'Email',
  'surveyor.website': 'Website',
  'company.name': 'Company name',
  'A.related_party': 'Related party disclosure',
  'A.weather': 'Weather conditions when the inspection took place',
  'A.occupancy': 'Status of the property when the inspection took place',
  'C.type': 'Type of property',
  'C.grounds': 'Grounds',
  'C.epc': 'Energy efficiency rating',
  'C.epc_issues': 'Issues relating to the energy efficiency rating',
  'C.other_energy_sources':
    'Other services or energy sources (including feed-in tariffs)',
  'C.other_energy': 'Other energy matters',
  'J.valuation': 'Valuation',
};

const DOCUMENT_RULES: Array<{
  codes: string[];
  ratings?: ConditionRating[];
  mention?: RegExp;
  covered: RegExp;
  document: string;
}> = [
  {
    codes: ['F1'],
    ratings: ['2', '3'],
    covered: /electric|eicr/i,
    document: 'Electrical installation condition report (EICR).',
  },
  {
    codes: ['F2', 'F4'],
    ratings: ['2', '3'],
    covered: /boiler|gas safe|oil tank|oftec|heating/i,
    document: 'Boiler and heating system servicing and safety certificates.',
  },
  {
    codes: ['F6'],
    ratings: ['2', '3'],
    covered: /drain/i,
    document: 'Drainage test report.',
  },
  {
    codes: ['D2', 'E1'],
    mention: /\b(replaced|renewed|re-roofed|new roof|recovered)\b/i,
    covered: /roof/i,
    document: 'Building control certificate for roof works.',
  },
  {
    codes: ['D5'],
    mention: /\b(replaced|replacement|double[- ]glaz)/i,
    covered: /fensa|window/i,
    document: 'FENSA certificate for replacement windows.',
  },
];

function fillMerge(html: string, merge: SurveyMergeValues): string {
  return html
    .replace(
      /\{\{#\s*([a-zA-Z0-9_.]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
      (_, path: string, inner: string) => (merge[path]?.trim() ? inner : ''),
    )
    .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
      const value = merge[path]?.trim();
      return value ? escapeHtml(value) : '';
    });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionKeyForCode(code: string): string | undefined {
  return buildingSurveySectionByRicsCode(code)?.key;
}

function observationMatches(
  item: SurveySlotObservation,
  ricsCode?: string,
  sectionKey?: string,
): boolean {
  if (ricsCode) {
    const code =
      item.ricsCode ||
      buildingSurveySectionByKey(item.sectionKey)?.ricsCode ||
      '';
    if (code === ricsCode) return true;
  }
  if (sectionKey && item.sectionKey === sectionKey) return true;
  return false;
}

function observationsFor(
  input: AssembleSurveyTemplateInput,
  ricsCode?: string,
  sectionKey?: string,
): SurveySlotObservation[] {
  return input.observations.filter((item) =>
    observationMatches(item, ricsCode, sectionKey),
  );
}

function photosFor(
  input: AssembleSurveyTemplateInput,
  ricsCode?: string,
  sectionKey?: string,
): SurveySlotPhoto[] {
  return (input.photos ?? []).filter((photo) => {
    if (ricsCode) {
      const code =
        photo.ricsCode ||
        buildingSurveySectionByKey(photo.sectionKey)?.ricsCode ||
        '';
      if (code === ricsCode) return true;
    }
    return Boolean(sectionKey && photo.sectionKey === sectionKey);
  });
}

function contentHtml(
  input: AssembleSurveyTemplateInput,
  ricsCode?: string,
  sectionKey?: string,
): string {
  if (sectionKey && input.sectionHtml?.[sectionKey]?.trim()) {
    return input.sectionHtml[sectionKey]!;
  }
  const bodies = observationsFor(input, ricsCode, sectionKey)
    .map((item) => item.body.trim())
    .filter(Boolean);
  if (bodies.length === 0) return '';
  return bodies.map((body) => paragraphsToHtml(body)).join('\n');
}

/** Lines of a free-text observation, with list markers removed. */
function contentLines(
  input: AssembleSurveyTemplateInput,
  ricsCode: string,
): string[] {
  const sectionKey = sectionKeyForCode(ricsCode);
  const html = sectionKey ? input.sectionHtml?.[sectionKey] : undefined;
  const raw = html?.trim()
    ? html
        .replace(/<\/(p|li|div|h[1-6])>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    : observationsFor(input, ricsCode, sectionKey)
        .map((item) => item.body)
        .join('\n');
  return raw
    .split('\n')
    .map((line) =>
      line
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '')
        .trim(),
    )
    .filter(Boolean);
}

function ratingFor(
  input: AssembleSurveyTemplateInput,
  ricsCode?: string,
  sectionKey?: string,
): ConditionRating | null {
  return (
    observationsFor(input, ricsCode, sectionKey).find(
      (item) => item.conditionRating,
    )?.conditionRating ?? null
  );
}

function headingBlock(
  text: string,
  extra: Partial<HeadingBlock> = {},
): SurveyReportBlock {
  return {
    id: createSurveyReportBlockId(),
    type: 'heading',
    text,
    level: extra.level ?? 2,
    sectionKey: extra.sectionKey,
    ricsCode: extra.ricsCode,
    conditionRating: extra.conditionRating,
    ...(extra.role ? { role: extra.role } : {}),
  };
}

function textBlock(html: string): SurveyReportBlock {
  return {
    id: createSurveyReportBlockId(),
    type: 'text',
    html: html.trim() || '<p></p>',
  };
}

function photoBlocks(photos: SurveySlotPhoto[]): SurveyReportBlock[] {
  return photos.map((photo) => {
    const caption = photo.caption?.trim() || photo.title;
    return {
      id: createSurveyReportBlockId(),
      type: 'image' as const,
      src: photo.url?.trim() || '',
      alt: caption,
      caption,
      documentId: photo.documentId,
      sectionKey: photo.sectionKey,
    };
  });
}

function fieldHtml(label: string, valueHtml: string): string {
  return `<section class="survey-field"><h4>${escapeHtml(label)}</h4>${valueHtml || '<p>n/a</p>'}</section>`;
}

function mergeValueHtml(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br />')}</p>`;
}

function isVisibleAtLevel(code: string, level: 2 | 3): boolean {
  const item = SURVEY_SECTION_CATALOGUE.find(
    (entry) => entry.ricsCode === code,
  );
  return !item || (item.visibleOnLevels as readonly number[]).includes(level);
}

function fieldLabelForCode(code: string): string {
  return (
    SURVEY_FIELD_LABELS[code] ??
    SURVEY_SECTION_CATALOGUE.find((entry) => entry.ricsCode === code)
      ?.heading ??
    buildingSurveySectionByRicsCode(code)?.heading ??
    code
  );
}

function fieldsHtml(
  block: SurveyTemplateBlock,
  input: AssembleSurveyTemplateInput,
): string {
  const level = templateLevel(input.template);
  const parts: string[] = [];
  for (const slot of block.slots ?? []) {
    if (slot.type === 'merge') {
      parts.push(
        fieldHtml(
          SURVEY_FIELD_LABELS[slot.path] ?? slot.path,
          mergeValueHtml(input.merge[slot.path]),
        ),
      );
    } else if (slot.type === 'content') {
      const code = slot.path.replace(/^element:/, '');
      if (!isVisibleAtLevel(code, level)) continue;
      parts.push(
        fieldHtml(
          fieldLabelForCode(code),
          contentHtml(input, code, sectionKeyForCode(code)),
        ),
      );
    } else if (slot.type === 'qualifications') {
      parts.push(qualificationsHtml(input.structured?.qualifications ?? []));
    }
  }
  return parts.join('\n');
}

function qualificationsHtml(items: SurveyorQualification[]): string {
  if (items.length === 0) return '';
  return `<table class="survey-qualifications"><thead><tr><th>Year</th><th>Establishment</th><th>Qualification</th></tr></thead><tbody>${items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.year)}</td><td>${escapeHtml(item.establishment)}</td><td>${escapeHtml(item.qualification)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function ratedElementBlocks(
  input: AssembleSurveyTemplateInput,
): SurveyTemplateBlock[] {
  return input.template.blocks.filter(
    (item) => item.kind === 'element' && isBlockIncluded(item, input),
  );
}

export function suggestedDocuments(
  input: AssembleSurveyTemplateInput,
): string[] {
  const recorded = contentLines(input, 'B.documents');
  const documents = [...recorded];
  for (const rule of DOCUMENT_RULES) {
    if (documents.some((line) => rule.covered.test(line))) continue;
    const triggered = rule.codes.some((code) => {
      const sectionKey = sectionKeyForCode(code);
      if (rule.ratings) {
        const rating = ratingFor(input, code, sectionKey);
        if (rating && rule.ratings.includes(rating)) return true;
      }
      if (rule.mention) {
        return rule.mention.test(
          stripHtml(contentHtml(input, code, sectionKey)),
        );
      }
      return false;
    });
    if (triggered) documents.push(rule.document);
  }
  return documents;
}

function documentsHtml(input: AssembleSurveyTemplateInput): string {
  const documents = suggestedDocuments(input);
  if (documents.length === 0) return '';
  return `<div class="survey-documents"><h3><span class="survey-rating-badge" data-rating="R">R</span> Documents we may suggest you request before you sign contracts</h3>${DOCUMENTS_INTRO}<table class="survey-documents-table"><thead><tr><th>Element no.</th><th>Document name</th><th>Received</th></tr></thead><tbody>${documents
    .map(
      (document, index) =>
        `<tr><td>${index + 1}</td><td>${escapeHtml(document)}</td><td></td></tr>`,
    )
    .join('')}</tbody></table></div>`;
}

function ratingSummaryHtml(input: AssembleSurveyTemplateInput): string {
  const groups: Record<ConditionRating, string[]> = {
    '3': [],
    '2': [],
    '1': [],
    NI: [],
    NA: [],
  };
  const unrated: string[] = [];

  for (const element of ratedElementBlocks(input)) {
    const section = element.sectionKey
      ? buildingSurveySectionByKey(element.sectionKey)
      : buildingSurveySectionByRicsCode(element.ricsCode ?? '');
    const label = section
      ? surveySectionDisplayLabel(section)
      : (element.ricsCode ?? '');
    const rating = ratingFor(input, element.ricsCode, element.sectionKey);
    if (rating) groups[rating].push(label);
    else unrated.push(label);
  }

  const parts = (['3', '2', '1', 'NI', 'NA'] as const)
    .map((rating) => {
      const items = groups[rating];
      if (items.length === 0) return '';
      const color = CONDITION_RATING_COLORS[rating];
      return `<h3>Condition rating ${rating}</h3><table><thead><tr><th>Element</th></tr></thead><tbody>${items
        .map(
          (label) =>
            `<tr><td><span class="survey-rating-badge" data-rating="${rating}" style="background:${color}">${rating}</span> ${escapeHtml(label)}</td></tr>`,
        )
        .join('')}</tbody></table>`;
    })
    .filter(Boolean);

  if (unrated.length > 0) {
    parts.push(
      `<h3>Not yet rated</h3><table class="survey-rating-unrated"><tbody>${unrated
        .map((label) => `<tr><td>${escapeHtml(label)}</td></tr>`)
        .join('')}</tbody></table>`,
    );
  }

  return parts.join('\n') || '<p>No condition ratings recorded yet.</p>';
}

const COST_RE =
  /^(.*?)(?:\s*[-–—:]\s*|\s+)(£\s?[\d,.]+(?:k)?(?:\s*(?:-|–|to)\s*£?\s?[\d,.]+(?:k)?)?|TBC|tbc|N\/A|n\/a)\s*\.?$/;

function repairsHtml(input: AssembleSurveyTemplateInput): string {
  const lines = contentLines(input, 'B.repairs');
  const investigations = contentHtml(
    input,
    'B.further_investigations',
    'further_investigations',
  );
  const parts: string[] = [];
  if (lines.length > 0) {
    const rows = lines.map((line) => {
      const match = COST_RE.exec(line);
      return match ? [match[1]!.trim(), match[2]!.trim()] : [line.trim(), ''];
    });
    parts.push(
      REPAIRS_INTRO,
      `<table class="survey-repairs-table"><thead><tr><th>Repairs</th><th>Cost guidance (optional)</th></tr></thead><tbody>${rows
        .map(
          ([repair, cost]) =>
            `<tr><td>${escapeHtml(repair!)}</td><td>${escapeHtml(cost!)}</td></tr>`,
        )
        .join('')}</tbody></table>`,
    );
  }
  if (investigations.trim()) {
    parts.push(
      '<h4>Further investigations</h4>',
      FURTHER_INVESTIGATIONS_INTRO,
      investigations,
    );
  }
  return parts.join('\n');
}

function accommodationHtml(accommodation: SurveyAccommodation): string {
  const header = ACCOMMODATION_ROOMS.map(
    (room) => `<th>${escapeHtml(room.label)}</th>`,
  ).join('');
  const rows = ACCOMMODATION_FLOORS.map((floor) => {
    const counts = accommodation[floor.key] ?? {};
    const cells = ACCOMMODATION_ROOMS.map((room) => {
      const count = counts[room.key] ?? 0;
      return `<td>${count > 0 ? count : ''}</td>`;
    }).join('');
    return `<tr><th>${escapeHtml(floor.label)}</th>${cells}</tr>`;
  }).join('');
  return `<table class="survey-accommodation"><thead><tr><th></th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function checklistHtml(
  title: string,
  note: string | null,
  options: ReadonlyArray<{ key: string; label: string }>,
  selected: string[],
): string {
  return `<div class="survey-checklist"><h4>${escapeHtml(title)}</h4>${
    note ? `<p>${escapeHtml(note)}</p>` : ''
  }<ul>${options
    .map(
      (option) =>
        `<li data-checked="${selected.includes(option.key)}">${selected.includes(option.key) ? '☒' : '☐'} ${escapeHtml(option.label)}</li>`,
    )
    .join('')}</ul></div>`;
}

function servicesHtml(services: SurveyServices): string {
  return [
    checklistHtml(
      'Main services',
      'A marked box shows that the relevant mains service is present.',
      MAIN_SERVICES,
      services.main,
    ),
    checklistHtml(
      'Central heating',
      null,
      CENTRAL_HEATING.filter((item) => item.key !== 'none'),
      services.heating,
    ),
  ].join('\n');
}

export function isFlatProperty(input: AssembleSurveyTemplateInput): boolean {
  const explicit = input.merge['property.type']?.trim();
  const text =
    explicit ||
    stripHtml(contentHtml(input, 'C.type', 'property_type')) ||
    stripHtml(contentHtml(input, 'C.flats', 'flats_info'));
  return /\b(flat|maisonette|apartment)\b/i.test(text);
}

function isBlockIncluded(
  block: SurveyTemplateBlock,
  input: AssembleSurveyTemplateInput,
): boolean {
  if (block.levels && !block.levels.includes(templateLevel(input.template))) {
    return false;
  }
  if (block.showWhen) {
    const flat = isFlatProperty(input);
    if (block.showWhen === 'flat' ? !flat : flat) return false;
  }
  return true;
}

function blockTitle(block: SurveyTemplateBlock): string {
  return (
    block.title ||
    (block.sectionKey
      ? buildingSurveySectionByKey(block.sectionKey)?.heading
      : undefined) ||
    (block.ricsCode
      ? buildingSurveySectionByRicsCode(block.ricsCode)?.heading
      : undefined) ||
    block.kind
  );
}

/** Stable anchor id for a lettered section heading ("A About..." → "section-a"). */
export function surveySectionAnchorId(headingText: string): string | null {
  const match = /^([A-Z])\s+\S/.exec(headingText.trim());
  return match ? `section-${match[1]!.toLowerCase()}` : null;
}

function assembleBlock(
  block: SurveyTemplateBlock,
  input: AssembleSurveyTemplateInput,
): SurveyReportBlock[] {
  if (!isBlockIncluded(block, input)) return [];
  const title = blockTitle(block);

  switch (block.kind) {
    case 'cover':
      return [
        headingBlock(title || 'Survey report', { level: 1 }),
        textBlock(
          fillMerge(
            block.staticHtml ||
              '<p>{{property.address}}</p><p>{{client.name}}</p>',
            input.merge,
          ),
        ),
      ];
    case 'toc': {
      const items = input.template.blocks
        .filter(
          (item) =>
            item.kind === 'section_divider' &&
            item.letter &&
            isBlockIncluded(item, input),
        )
        .map((item) => {
          const label = `${item.letter} ${item.title ?? ''}`.trim();
          const anchor = surveySectionAnchorId(label);
          return `<li><a href="#${anchor}">${escapeHtml(label)}</a></li>`;
        })
        .join('');
      return [
        headingBlock('Contents'),
        textBlock(
          `${fillMerge(block.staticHtml || '', input.merge)}<ol class="survey-toc">${items}</ol>`,
        ),
      ];
    }
    case 'section_divider':
      return [
        headingBlock(block.letter ? `${block.letter} ${title}` : title, {
          level: 1,
          sectionKey: block.sectionKey,
          ricsCode: block.ricsCode,
        }),
        ...(block.staticHtml
          ? [textBlock(fillMerge(block.staticHtml, input.merge))]
          : []),
      ];
    case 'subsection':
      return [headingBlock(title, { role: 'subsection' })];
    case 'callout':
      return [textBlock(fillMerge(block.staticHtml || '', input.merge))];
    case 'static_html':
    case 'boilerplate': {
      const contentSlot = (block.slots ?? []).find(
        (slot) => slot.type === 'content',
      );
      const override = contentSlot
        ? contentHtml(input, block.ricsCode, block.sectionKey)
        : '';
      const html =
        override.trim() || fillMerge(block.staticHtml || '', input.merge);
      const heading = block.title
        ? headingBlock(block.title, {
            sectionKey: block.sectionKey,
            ricsCode: block.ricsCode,
          })
        : block.sectionKey
          ? headingBlock(
              surveySectionDisplayLabel({
                heading: title,
                ricsCode: block.ricsCode ?? '',
                letter: block.letter ?? '',
              }),
              { sectionKey: block.sectionKey, ricsCode: block.ricsCode },
            )
          : null;
      return [...(heading ? [heading] : []), textBlock(html || '<p></p>')];
    }
    case 'fields':
    case 'merge_fields':
    case 'form_fields':
    case 'property_fields': {
      const html = fieldsHtml(block, input);
      if (!html) return [];
      return [
        ...(block.title
          ? [
              headingBlock(block.title, {
                sectionKey: block.sectionKey,
                ricsCode: block.ricsCode,
              }),
            ]
          : []),
        textBlock(html),
      ];
    }
    case 'opinion':
      return [
        headingBlock(block.title || title, {
          sectionKey: block.sectionKey ?? 'overall_opinion',
        }),
        textBlock(
          contentHtml(input, 'B', block.sectionKey ?? 'overall_opinion') ||
            '<p></p>',
        ),
      ];
    case 'documents_table': {
      if (
        input.template.blocks.some((item) => item.kind === 'rating_summary')
      ) {
        return [];
      }
      const html = documentsHtml(input);
      return html ? [textBlock(html)] : [];
    }
    case 'rating_summary': {
      const includeDocuments = input.template.blocks.some(
        (item) =>
          item.kind === 'documents_table' && isBlockIncluded(item, input),
      );
      return [
        headingBlock('Condition ratings'),
        textBlock(
          [
            RATING_INTRO,
            includeDocuments ? documentsHtml(input) : '',
            ratingSummaryHtml(input),
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ];
    }
    case 'repairs_summary':
      return [
        headingBlock('Summary of repairs', { sectionKey: block.sectionKey }),
        textBlock(repairsHtml(input) || '<p></p>'),
      ];
    case 'accommodation_matrix': {
      const accommodation = input.structured?.accommodation;
      if (!accommodation || !accommodationHasCounts(accommodation)) return [];
      return [
        headingBlock(block.title || 'Accommodation'),
        textBlock(accommodationHtml(accommodation)),
      ];
    }
    case 'services_grid': {
      const services = input.structured?.services;
      if (!services) return [];
      return [textBlock(servicesHtml(services))];
    }
    case 'element': {
      const section = block.sectionKey
        ? buildingSurveySectionByKey(block.sectionKey)
        : buildingSurveySectionByRicsCode(block.ricsCode ?? '');
      const photos = photoBlocks(
        photosFor(input, block.ricsCode, block.sectionKey),
      );
      const rating = ratingFor(input, block.ricsCode, block.sectionKey);
      const label = section
        ? surveySectionDisplayLabel(section)
        : `${block.ricsCode ?? ''} ${title}`.trim();
      const body = contentHtml(input, block.ricsCode, block.sectionKey);
      const fallback =
        rating === 'NA'
          ? '<p>Not applicable.</p>'
          : rating === 'NI'
            ? '<p>Not inspected.</p>'
            : '<p></p>';
      return [
        ...photos,
        headingBlock(label, {
          sectionKey: block.sectionKey ?? section?.key,
          ricsCode: block.ricsCode ?? section?.ricsCode,
          conditionRating: rating ?? undefined,
        }),
        textBlock(body || fallback),
      ];
    }
    case 'legal_sub':
    case 'risks_sub':
    case 'energy_sub':
      return [
        headingBlock(title, {
          sectionKey: block.sectionKey,
          ricsCode: block.ricsCode,
        }),
        textBlock(
          contentHtml(input, block.ricsCode, block.sectionKey) || '<p></p>',
        ),
      ];
    case 'declaration':
      return [
        headingBlock(title, { sectionKey: 'declaration', ricsCode: 'K' }),
        textBlock(
          [
            fieldsHtml(block, input),
            fillMerge(
              block.staticHtml ||
                '<p>I confirm that I have inspected the property and prepared this report.</p>',
              input.merge,
            ),
          ].join('\n'),
        ),
      ];
    case 'diagram':
      return [
        headingBlock(title, {
          sectionKey: block.sectionKey,
          ricsCode: block.ricsCode,
        }),
        ...(block.staticHtml
          ? [textBlock(fillMerge(block.staticHtml, input.merge))]
          : []),
        ...photoBlocks(photosFor(input, block.ricsCode, block.sectionKey)),
      ];
    default:
      return [];
  }
}

export function assembleSurveyReportFromTemplate(
  input: AssembleSurveyTemplateInput,
): SurveyReportDocument {
  const blocks = input.template.blocks.flatMap((block) =>
    assembleBlock(block, input),
  );
  return { version: 1, blocks };
}

export function mergeValuesFromSurvey(input: {
  propertyAddress?: string | null;
  propertyType?: string | null;
  clientName?: string | null;
  inspectionDate?: string | null;
  producedDate?: string | null;
  reportReference?: string | null;
  termsReceivedDate?: string | null;
  weather?: string | null;
  occupancy?: string | null;
  surveyorName?: string | null;
  surveyorRicsNumber?: string | null;
  surveyorPhone?: string | null;
  surveyorEmail?: string | null;
  surveyorWebsite?: string | null;
  surveyorAddress?: string | null;
  companyName?: string | null;
}): SurveyMergeValues {
  return {
    'property.address': input.propertyAddress,
    'property.type': input.propertyType,
    'client.name': input.clientName,
    'inspection.date': input.inspectionDate,
    'report.producedDate': input.producedDate,
    'report.reference': input.reportReference,
    'terms.receivedDate': input.termsReceivedDate,
    weather: input.weather,
    occupancy: input.occupancy,
    'surveyor.name': input.surveyorName,
    'surveyor.ricsNumber': input.surveyorRicsNumber,
    'surveyor.phone': input.surveyorPhone,
    'surveyor.email': input.surveyorEmail,
    'surveyor.website': input.surveyorWebsite,
    'surveyor.address': input.surveyorAddress,
    'company.name': input.companyName,
  };
}
