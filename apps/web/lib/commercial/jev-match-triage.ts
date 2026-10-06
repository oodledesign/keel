import 'server-only';

import {
  type TypeSafeQuestion,
  askTypeSafe,
  isTypeSafeConfigured,
} from '~/lib/ai/typesafe';
import type { MatchSuggestionForAi } from '~/lib/commercial/ai-match';

const MAX_PAIRS = 40;
/** Below this confidence a Jev recommendation is downgraded to "review". */
const MIN_CONFIDENCE = 0.55;

export function isJevMatchTriageEnabled(): boolean {
  return isTypeSafeConfigured();
}

export type JevMatchVerdict = {
  recommendation: 'add' | 'skip' | 'review';
  /** 0-100 probability the pair is a genuine fit. */
  fitScore: number;
};

/**
 * Triage disposal↔requirement pairs with Jev. Two atomic questions per pair
 * (recommendation + is-it-a-genuine-fit), all in one request. The rule engine
 * has already compared sizes and tenure, so Jev only judges the fuzzy parts
 * (sector and location wording). Returns null on any failure so the caller can
 * fall back to the generative triage.
 */
export async function triageMatchesWithJev(
  suggestions: readonly MatchSuggestionForAi[],
): Promise<Map<string, JevMatchVerdict> | null> {
  if (!isJevMatchTriageEnabled() || suggestions.length === 0) return null;

  const pairs = suggestions.slice(0, MAX_PAIRS);

  try {
    const state: Record<string, unknown> = {};
    const questions: Record<string, TypeSafeQuestion> = {};

    pairs.forEach((pair, index) => {
      const id = `p${index}`;
      state[id] = {
        listing: {
          name: pair.listingName,
          sector: pair.listingSector,
          town: pair.listingTown,
          disposal_type: pair.listingDisposalType,
        },
        requirement: {
          label: pair.requirementLabel,
          sector: pair.requirementSector,
          location_wanted: pair.requirementLocationText,
          tenure: pair.requirementTenure,
        },
        size_and_tenure_checks: pair.reasons,
      };
      questions[`rec_${id}`] = {
        type: 'choice',
        instructions: `For \`${id}\`: should the agent add this listing to the requirement's Interest Schedule? Treat \`size_and_tenure_checks\` as already verified.`,
        criteria: {
          review:
            'Unclear or partly matching: sector or location fit is uncertain, so a person should look',
          add: 'Clear fit: the listing sector and town suit what the requirement wants',
          skip: 'Mismatch: the listing sector or location clearly does not suit the requirement',
        },
      };
      questions[`fit_${id}`] = {
        type: 'noul',
        instructions: `Is the listing in \`${id}.listing\` a genuine fit for \`${id}.requirement\` in sector and location?`,
      };
    });

    const { answers } = await askTypeSafe({ state, questions });
    const verdicts = new Map<string, JevMatchVerdict>();

    pairs.forEach((pair, index) => {
      const id = `p${index}`;
      const rec = answers[`rec_${id}`];
      const fit = answers[`fit_${id}`];

      if (!rec || rec.type !== 'choice' || !fit || fit.type !== 'noul') return;

      const choice = rec.choice as JevMatchVerdict['recommendation'];
      const recommendation =
        (choice === 'add' || choice === 'skip' || choice === 'review') &&
        rec.confidence >= MIN_CONFIDENCE
          ? choice
          : 'review';

      verdicts.set(`${pair.listingId}:${pair.requirementId}`, {
        recommendation,
        fitScore: Math.round(Math.max(0, Math.min(1, fit.noul)) * 100),
      });
    });

    return verdicts.size > 0 ? verdicts : null;
  } catch (error) {
    console.error(
      '[jev-match-triage] falling back',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
