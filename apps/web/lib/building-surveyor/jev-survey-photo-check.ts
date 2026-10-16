import 'server-only';

import {
  fetchBytesForJev,
  newJevImageRef,
  prepareJevJpeg,
} from '~/lib/ai/jev-image.server';
import {
  type TypeSafeQuestion,
  askTypeSafe,
  isTypeSafeConfigured,
} from '~/lib/ai/typesafe';
import {
  surveySectionByKey,
  surveySectionDisplayLabel,
} from '~/lib/building-surveyor/survey-section-catalogue';

/** Cap per run — each photo is its own Jev request (one image + a few questions). */
const MAX_PHOTOS = 12;
const MIN_NOUL_REPORTABLE = 0.55;
const MIN_NOUL_MATCH = 0.55;
const MIN_CHOICE_CONFIDENCE = 0.55;

const ELEMENT_GROUP_CRITERIA: Record<string, string> = {
  D: 'Outside the property: chimneys, roofs, walls, rainwater goods, joinery at height.',
  E: 'Outside at ground level: windows, doors, conservatories, porch, external decorations.',
  F: 'Services: electricity, gas, water, heating, drainage.',
  G: 'Inside the property: rooms, floors, walls, ceilings, kitchen, bathroom, cellar.',
  H: 'Grounds: gardens, boundaries, outbuildings, shared areas, parking.',
  C: 'Whole-property context: elevations, street view, setting, construction overview.',
  other: 'Not a useful survey photo, or the subject is unclear.',
};

export function isJevSurveyPhotoCheckEnabled(): boolean {
  return isTypeSafeConfigured();
}

export type SurveyPhotoJevInput = {
  id: string;
  /** Signed URL or public URL; used when bytes are not provided. */
  url?: string | null;
  bytes?: Uint8Array | null;
  title?: string | null;
  taggedSectionKey?: string | null;
  taggedRicsCode?: string | null;
  taggedLabel?: string | null;
};

export type SurveyPhotoJevSuggestion = {
  photoId: string;
  /** true = likely report-worthy; false = cull; null = unknown. */
  reportable: boolean | null;
  reportableNoul: number | null;
  /** Suggested coarse letter when untagged. */
  suggestedGroup: string | null;
  /** When the photo is tagged, whether it appears to match that element. */
  tagMatch: boolean | null;
  tagMismatch: boolean;
  detail: string | null;
};

export type SurveyPhotoJevBatchResult = {
  suggestions: SurveyPhotoJevSuggestion[];
  skipped: number;
};

function noulTruthy(noul: number | undefined, min: number): boolean | null {
  if (typeof noul !== 'number' || Number.isNaN(noul)) return null;
  if (noul >= min) return true;
  if (noul <= 1 - min) return false;
  return null;
}

/**
 * Suggest report-worthiness and (when tagged) tag match for survey photos.
 * Untagged photos get a coarse RICS letter-group suggestion. Failures return
 * empty suggestions so Gemini curation is never blocked.
 */
export async function checkSurveyPhotosWithJev(input: {
  photos: readonly SurveyPhotoJevInput[];
}): Promise<SurveyPhotoJevBatchResult> {
  if (!isJevSurveyPhotoCheckEnabled()) {
    return { suggestions: [], skipped: input.photos.length };
  }

  const candidates = input.photos.slice(0, MAX_PHOTOS);
  const suggestions: SurveyPhotoJevSuggestion[] = [];
  let skipped = Math.max(0, input.photos.length - candidates.length);

  for (const photo of candidates) {
    try {
      const raw =
        photo.bytes ?? (photo.url ? await fetchBytesForJev(photo.url) : null);
      if (!raw) {
        skipped += 1;
        continue;
      }

      const prepared = await prepareJevJpeg(raw);
      if (!prepared) {
        skipped += 1;
        continue;
      }

      const ref = newJevImageRef('survey');
      const taggedKey = photo.taggedSectionKey?.trim() || null;
      const tagged = taggedKey != null ? surveySectionByKey(taggedKey) : null;
      const taggedLabel =
        photo.taggedLabel?.trim() ||
        (tagged
          ? surveySectionDisplayLabel(tagged)
          : photo.taggedRicsCode?.trim() || null);

      const questions: Record<string, TypeSafeQuestion> = {
        reportable: {
          type: 'noul',
          instructions: `Is \`photo\` a clear, useful site photograph for a UK RICS Home Survey report (a building element, defect, elevation, or grounds feature — not a blur, sky-only, shoe, or duplicate junk frame)?`,
          criteria: {
            true: 'Clear photo of a building element, defect, elevation, or grounds that a surveyor would put in the report.',
            false:
              'Blurry, incidental, irrelevant, or not useful as a survey report photograph.',
          },
        },
      };

      if (taggedLabel) {
        questions.tag_match = {
          type: 'noul',
          instructions: `Does \`photo\` show the building element described as "${taggedLabel}"?`,
          criteria: {
            true: `The main subject of the photo is ${taggedLabel}.`,
            false: `The photo shows something else, or the subject is unclear.`,
          },
        };
      } else {
        questions.element_group = {
          type: 'choice',
          instructions: `Which RICS Home Survey area does \`photo\` belong to?`,
          criteria: ELEMENT_GROUP_CRITERIA,
        };
      }

      const { answers } = await askTypeSafe({
        state: {
          photo: ref,
          title: photo.title?.trim().slice(0, 120) || null,
        },
        assets: { [ref]: prepared.asset },
        questions,
      });

      const reportableAnswer = answers.reportable;
      const reportableNoul =
        reportableAnswer?.type === 'noul' ? reportableAnswer.noul : null;
      const reportable = noulTruthy(
        reportableNoul ?? undefined,
        MIN_NOUL_REPORTABLE,
      );

      let tagMatch: boolean | null = null;
      let tagMismatch = false;
      let suggestedGroup: string | null = null;
      let detail: string | null = null;

      if (taggedLabel && answers.tag_match?.type === 'noul') {
        tagMatch = noulTruthy(answers.tag_match.noul, MIN_NOUL_MATCH);
        if (tagMatch === false) {
          tagMismatch = true;
          detail = `Tagged as ${taggedLabel}, but the photo may show something else (suggestion only).`;
        }
      }

      if (
        !taggedLabel &&
        answers.element_group?.type === 'choice' &&
        answers.element_group.confidence >= MIN_CHOICE_CONFIDENCE &&
        answers.element_group.choice !== 'other'
      ) {
        suggestedGroup = answers.element_group.choice;
        const label =
          ELEMENT_GROUP_CRITERIA[suggestedGroup]?.split(':')[0] ??
          suggestedGroup;
        detail = `Looks like section ${suggestedGroup} (${label}). Suggestion only.`;
      }

      if (reportable === false) {
        detail =
          detail ??
          'Photo may not be clear enough for the report (suggestion only).';
      }

      suggestions.push({
        photoId: photo.id,
        reportable,
        reportableNoul,
        suggestedGroup,
        tagMatch,
        tagMismatch,
        detail,
      });
    } catch (error) {
      console.error(
        '[jev-survey-photo-check] photo skipped',
        photo.id,
        error instanceof Error ? error.message : String(error),
      );
      skipped += 1;
    }
  }

  return { suggestions, skipped };
}

/** Photos Jev thinks should stay in curation (or unknown — keep them). */
export function filterReportablePhotoIds(
  photoIds: readonly string[],
  suggestions: readonly SurveyPhotoJevSuggestion[],
): string[] {
  const byId = new Map(suggestions.map((item) => [item.photoId, item]));
  return photoIds.filter((id) => {
    const hit = byId.get(id);
    if (!hit || hit.reportable === null) return true;
    return hit.reportable === true;
  });
}
