import type { ConditionRating } from './condition-rating';
import {
  BUILDING_SURVEY_SECTIONS,
  buildingSurveySectionByKey,
  resolveSurveySectionKey,
  surveySectionDisplayLabel,
} from './rics-catalogue';

/**
 * Standard UK building / RICS Home Survey headings.
 * Phrase-bank / template codes live in rics-catalogue.ts.
 * Hub L2/L3 visibility uses survey-section-catalogue.ts.
 */
export {
  BUILDING_SURVEY_SECTIONS,
  buildingSurveySectionByKey,
  buildingSurveySectionByRicsCode,
  ratedSurveySections,
  resolveSurveySectionKey,
  ricsCodeForSectionKey,
  sectionsForSurveyType,
  surveyLevelForType,
  surveySectionDisplayLabel,
  type BuildingSurveySection,
  type BuildingSurveySectionKey,
} from './rics-catalogue';

export function buildingSurveyBlankHtml(): string {
  return BUILDING_SURVEY_SECTIONS.map(
    (section) =>
      `<h2 data-section="${section.key}" data-rics="${escapeHtml(section.ricsCode)}">${escapeHtml(surveySectionDisplayLabel(section))}</h2>\n<p></p>`,
  ).join('\n');
}

export function buildingSurveySectionListForPrompt(): string {
  return BUILDING_SURVEY_SECTIONS.map(
    (section, index) =>
      `${index + 1}. ${surveySectionDisplayLabel(section)} (${section.key}, ${section.ricsCode})`,
  ).join('\n');
}

export type SurveyObservationDraft = {
  sectionKey: string;
  ricsCode?: string | null;
  body: string;
  sortOrder: number;
  conditionRating?: ConditionRating | null;
};

export type SurveyObservationInput = {
  sectionKey: string;
  ricsCode?: string | null;
  body: string;
  conditionRating?: ConditionRating | null;
};

export type SurveyPinnedPhotoInput = {
  sectionKey: string;
  title: string;
  caption?: string | null;
  documentId?: string;
  url?: string | null;
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
  return splitTranscriptParagraphs(transcript).map((body, index) => {
    const sectionKey = bestSectionKeyForText(body);
    return {
      sectionKey,
      ricsCode: buildingSurveySectionByKey(sectionKey)?.ricsCode ?? null,
      body,
      sortOrder: index,
    };
  });
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
    const resolved = resolveSurveySectionKey(assignment.sectionKey);
    if (!resolved) continue;
    byIndex.set(assignment.index, resolved);
  }

  return paragraphs.map((body, index) => {
    const sectionKey = byIndex.get(index) ?? bestSectionKeyForText(body);
    return {
      sectionKey,
      ricsCode: buildingSurveySectionByKey(sectionKey)?.ricsCode ?? null,
      body,
      sortOrder: index,
    };
  });
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

    const rating = observations.find(
      (item) => item.sectionKey === section.key && item.conditionRating,
    )?.conditionRating;
    const ratingAttr = rating ? ` data-rating="${escapeHtml(rating)}"` : '';

    return `<h2 data-section="${section.key}" data-rics="${escapeHtml(section.ricsCode)}"${ratingAttr}>${escapeHtml(surveySectionDisplayLabel(section))}</h2>\n${
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
