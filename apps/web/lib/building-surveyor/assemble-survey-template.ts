import type { ConditionRating } from './condition-rating';
import { CONDITION_RATING_COLORS } from './condition-rating';
import {
  BUILDING_SURVEY_SECTIONS,
  buildingSurveySectionByKey,
  buildingSurveySectionByRicsCode,
  surveySectionDisplayLabel,
} from './rics-catalogue';
import {
  type SurveyReportBlock,
  type SurveyReportDocument,
  createSurveyReportBlockId,
  paragraphsToHtml,
} from './survey-report-document';
import type {
  SurveyTemplateBlock,
  SurveyTemplateDefinition,
} from './survey-template';

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

export type AssembleSurveyTemplateInput = {
  template: SurveyTemplateDefinition;
  merge: SurveyMergeValues;
  observations: SurveySlotObservation[];
  photos?: SurveySlotPhoto[];
  sectionHtml?: Record<string, string>;
};

function fillMerge(html: string, merge: SurveyMergeValues): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
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
  extra: Partial<Extract<SurveyReportBlock, { type: 'heading' }>> = {},
): SurveyReportBlock {
  return {
    id: createSurveyReportBlockId(),
    type: 'heading',
    text,
    level: extra.level ?? 2,
    sectionKey: extra.sectionKey,
    ricsCode: extra.ricsCode,
    conditionRating: extra.conditionRating,
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

function mergeDefinitionList(
  paths: string[],
  merge: SurveyMergeValues,
): string {
  const rows = paths
    .map((path) => {
      const value = merge[path]?.trim();
      if (!value) return '';
      return `<tr><th>${escapeHtml(path)}</th><td>${escapeHtml(value)}</td></tr>`;
    })
    .filter(Boolean);
  if (rows.length === 0) return '';
  return `<table class="survey-merge-fields">${rows.join('')}</table>`;
}

function ratingSummaryHtml(input: AssembleSurveyTemplateInput): string {
  const groups: Record<string, string[]> = {
    '3': [],
    '2': [],
    '1': [],
    NI: [],
    NA: [],
  };

  for (const section of BUILDING_SURVEY_SECTIONS.filter(
    (item) => item.allowsRating,
  )) {
    const rating = ratingFor(input, section.ricsCode, section.key);
    if (!rating) continue;
    groups[rating]?.push(surveySectionDisplayLabel(section));
  }

  const parts = (['3', '2', '1', 'NI', 'NA'] as const)
    .map((rating) => {
      const items = groups[rating] ?? [];
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

  return parts.join('\n') || '<p>No condition ratings recorded yet.</p>';
}

function assembleBlock(
  block: SurveyTemplateBlock,
  input: AssembleSurveyTemplateInput,
): SurveyReportBlock[] {
  const title =
    block.title ||
    (block.sectionKey
      ? buildingSurveySectionByKey(block.sectionKey)?.heading
      : undefined) ||
    (block.ricsCode
      ? buildingSurveySectionByRicsCode(block.ricsCode)?.heading
      : undefined) ||
    block.kind;

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
      const letters = [
        ...new Set(
          input.template.blocks
            .map((item) => item.letter)
            .filter((letter): letter is string => Boolean(letter)),
        ),
      ];
      const items = letters
        .map((letter) => {
          const first = input.template.blocks.find(
            (item) => item.letter === letter && item.kind === 'section_divider',
          );
          return `<li>${escapeHtml(letter)} ${escapeHtml(first?.title ?? '')}</li>`;
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
    case 'static_html':
    case 'boilerplate': {
      const extra = contentHtml(input, block.ricsCode, block.sectionKey);
      const html = [fillMerge(block.staticHtml || '', input.merge), extra]
        .filter(Boolean)
        .join('\n');
      return [
        ...(block.sectionKey
          ? [
              headingBlock(
                surveySectionDisplayLabel({
                  heading: title,
                  ricsCode: block.ricsCode ?? '',
                  letter: block.letter ?? '',
                }),
                {
                  sectionKey: block.sectionKey,
                  ricsCode: block.ricsCode,
                },
              ),
            ]
          : []),
        textBlock(html || '<p></p>'),
      ];
    }
    case 'merge_fields':
    case 'form_fields':
    case 'property_fields': {
      const mergePaths = (block.slots ?? [])
        .filter((slot) => slot.type === 'merge')
        .map((slot) => slot.path);
      const extra = (block.slots ?? [])
        .filter((slot) => slot.type === 'content')
        .map((slot) => {
          const code = slot.path.replace(/^element:/, '');
          return contentHtml(input, code, block.sectionKey);
        })
        .filter(Boolean)
        .join('\n');
      return [
        headingBlock(title, {
          sectionKey: block.sectionKey,
          ricsCode: block.ricsCode,
        }),
        textBlock(
          [mergeDefinitionList(mergePaths, input.merge), extra]
            .filter(Boolean)
            .join('\n') || '<p></p>',
        ),
      ];
    }
    case 'opinion':
      return [
        headingBlock(title, {
          sectionKey: block.sectionKey ?? 'overall_opinion',
        }),
        textBlock(
          contentHtml(input, 'B', block.sectionKey ?? 'overall_opinion') ||
            '<p></p>',
        ),
      ];
    case 'rating_summary':
      return [
        headingBlock('Condition ratings'),
        textBlock(ratingSummaryHtml(input)),
      ];
    case 'repairs_summary':
      return [
        headingBlock('Summary of repairs and further investigations', {
          sectionKey: block.sectionKey,
        }),
        textBlock(
          [
            contentHtml(input, 'B.repairs', 'repairs_summary'),
            contentHtml(
              input,
              'B.further_investigations',
              'further_investigations',
            ),
          ]
            .filter(Boolean)
            .join('\n') || '<p></p>',
        ),
      ];
    case 'accommodation_matrix':
      return [headingBlock('Accommodation'), textBlock('<p></p>')];
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
      return [
        ...photos,
        headingBlock(label, {
          sectionKey: block.sectionKey ?? section?.key,
          ricsCode: block.ricsCode ?? section?.ricsCode,
          conditionRating: rating ?? undefined,
        }),
        textBlock(
          contentHtml(input, block.ricsCode, block.sectionKey) || '<p></p>',
        ),
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
          fillMerge(
            block.staticHtml || '<p>{{surveyor.name}}</p>',
            input.merge,
          ),
        ),
      ];
    case 'diagram':
      return [
        headingBlock(title, {
          sectionKey: block.sectionKey,
          ricsCode: block.ricsCode,
        }),
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
  clientName?: string | null;
  inspectionDate?: string | null;
  producedDate?: string | null;
  reportReference?: string | null;
  weather?: string | null;
  occupancy?: string | null;
  surveyorName?: string | null;
  surveyorRicsNumber?: string | null;
  companyName?: string | null;
}): SurveyMergeValues {
  return {
    'property.address': input.propertyAddress,
    'client.name': input.clientName,
    'inspection.date': input.inspectionDate,
    'report.producedDate': input.producedDate,
    'report.reference': input.reportReference,
    weather: input.weather,
    occupancy: input.occupancy,
    'surveyor.name': input.surveyorName,
    'surveyor.ricsNumber': input.surveyorRicsNumber,
    'company.name': input.companyName,
  };
}
