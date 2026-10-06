import 'server-only';

import { askTypeSafe, isTypeSafeConfigured } from '~/lib/ai/typesafe';

import {
  CONDITION_RATING_LABELS,
  type ConditionRating,
} from './condition-rating';
import type { SurveyGapFlag } from './survey-report-gap-check';

/** Jev loses accuracy on large state, so keep each note short. */
const MAX_NOTE_CHARS = 1_500;
const MAX_SECTIONS = 40;
const MIN_CONFIDENCE = 0.6;
const MISMATCH_MIN_PROBABILITY = 0.7;

export type RatingCheckSection = {
  key: string;
  ricsCode: string;
  label: string;
  /** The surveyor's own notes for this element. */
  notes: string;
  /** Rating the surveyor already chose (most serious across notes), if any. */
  currentRating: ConditionRating | null;
};

type NumericRating = '1' | '2' | '3';

const SEVERITY: Record<NumericRating, number> = { '1': 1, '2': 2, '3': 3 };

function isNumeric(value: string): value is NumericRating {
  return value === '1' || value === '2' || value === '3';
}

export function isJevRatingCheckEnabled(): boolean {
  return isTypeSafeConfigured();
}

/**
 * Suggests a condition rating from each element's notes and returns gap flags:
 * a suggestion for unrated elements, and a warning when the surveyor's rating
 * looks milder than the notes. Suggestions only; the surveyor decides. Returns
 * [] on any failure so the deterministic gap check is never blocked.
 */
export async function checkRatingsWithJev(
  sections: readonly RatingCheckSection[],
): Promise<SurveyGapFlag[]> {
  if (!isJevRatingCheckEnabled()) return [];

  const candidates = sections
    .filter((section) => section.notes.trim().length > 0)
    .slice(0, MAX_SECTIONS);

  if (candidates.length === 0) return [];

  try {
    const state: Record<string, { element: string; surveyor_notes: string }> =
      {};
    const questions: Record<
      string,
      {
        type: 'choice';
        instructions: string;
        criteria: Record<string, string>;
      }
    > = {};

    candidates.forEach((section, index) => {
      const id = `s${index}`;
      state[id] = {
        element: section.label,
        surveyor_notes: section.notes.trim().slice(0, MAX_NOTE_CHARS),
      };
      questions[id] = {
        type: 'choice',
        instructions: `Using only the defects described in \`${id}.surveyor_notes\`, which RICS condition rating fits this element?`,
        criteria: {
          '2': 'Defects that need repairing or replacing but are not serious or urgent. Maintain in the normal way.',
          '1': 'No repair is currently needed. The notes describe no defects.',
          '3': 'Defects that are serious and/or need to be repaired, replaced or investigated urgently, or that risk serious safety issues or severe long-term damage.',
        },
      };
    });

    const { answers } = await askTypeSafe({ state, questions });
    const flags: SurveyGapFlag[] = [];

    candidates.forEach((section, index) => {
      const answer = answers[`s${index}`];

      if (
        !answer ||
        answer.type !== 'choice' ||
        !isNumeric(answer.choice) ||
        answer.confidence < MIN_CONFIDENCE
      ) {
        return;
      }

      const suggested = answer.choice;
      const label = CONDITION_RATING_LABELS[suggested];

      if (section.currentRating === null) {
        flags.push({
          kind: 'missing_rating',
          sectionKey: section.key,
          ricsCode: section.ricsCode,
          label: section.label,
          detail: `${section.label} has findings but no condition rating. The notes read like ${label.toLowerCase()} (suggestion only, please confirm).`,
        });
        return;
      }

      if (
        isNumeric(section.currentRating) &&
        SEVERITY[suggested] > SEVERITY[section.currentRating] &&
        (answer.probabilities[suggested] ?? 0) >= MISMATCH_MIN_PROBABILITY
      ) {
        flags.push({
          kind: 'rating_mismatch',
          sectionKey: section.key,
          ricsCode: section.ricsCode,
          label: section.label,
          detail: `${section.label} is rated ${section.currentRating} but the notes read like ${label.toLowerCase()}. Please check the rating (suggestion only).`,
        });
      }
    });

    return flags;
  } catch (error) {
    console.error(
      '[jev-rating-check] skipped',
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}
