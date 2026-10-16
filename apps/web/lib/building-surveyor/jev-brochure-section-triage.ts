import 'server-only';

import {
  type TypeSafeQuestion,
  askTypeSafe,
  isTypeSafeConfigured,
} from '~/lib/ai/typesafe';
import {
  BROCHURE_SECTION_KEYS,
  type BrochureMappedPassage,
  type BrochureSectionKey,
  isBrochureSectionKey,
} from '~/lib/building-surveyor/brochure-import';

const MAX_CHUNKS = 12;
const MAX_CHUNK_CHARS = 1_200;
const MIN_CONFIDENCE = 0.55;

const SECTION_CRITERIA: Record<string, string> = {
  location:
    'Neighbourhood, setting, roads, amenities, orientation, or general location of the property.',
  location_grounds:
    'The plot or site in context (frontage, boundaries as setting) rather than detailed garden description.',
  grounds:
    'Gardens, patios, outbuildings, parking, fences, and other grounds features.',
  skip: 'Marketing fluff, pricing, agent contact details, room schedule only, or nothing relevant to location/grounds.',
};

export function isJevBrochureTriageEnabled(): boolean {
  return isTypeSafeConfigured();
}

export function splitBrochureChunks(text: string): string[] {
  const normalised = text.replace(/\s+/g, ' ').trim();
  if (!normalised) return [];

  const paragraphs = normalised
    .split(/(?<=\.)\s+(?=[A-Z])|\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40);

  const source = paragraphs.length > 0 ? paragraphs : [normalised];
  const chunks: string[] = [];

  for (const part of source) {
    if (chunks.length >= MAX_CHUNKS) break;
    if (part.length <= MAX_CHUNK_CHARS) {
      chunks.push(part);
      continue;
    }
    let offset = 0;
    while (offset < part.length && chunks.length < MAX_CHUNKS) {
      chunks.push(part.slice(offset, offset + MAX_CHUNK_CHARS).trim());
      offset += MAX_CHUNK_CHARS;
    }
  }

  return chunks;
}

/**
 * Assign brochure text chunks to location / location_grounds / grounds / skip
 * with Jev (text only). Returns null on failure so the caller can fall back to
 * the generative mapper. Does not rewrite prose.
 */
export async function triageBrochureChunksWithJev(
  chunks: readonly string[],
): Promise<BrochureMappedPassage[] | null> {
  if (!isJevBrochureTriageEnabled() || chunks.length === 0) return null;

  const batch = chunks.slice(0, MAX_CHUNKS);

  try {
    const state: Record<string, { passage: string }> = {};
    const questions: Record<string, TypeSafeQuestion> = {};

    batch.forEach((passage, index) => {
      const id = `c${index}`;
      state[id] = { passage: passage.slice(0, MAX_CHUNK_CHARS) };
      questions[id] = {
        type: 'choice',
        instructions: `Which RICS Home Survey property section does \`${id}.passage\` belong to?`,
        criteria: SECTION_CRITERIA,
      };
    });

    const { answers } = await askTypeSafe({ state, questions });

    const bySection = new Map<BrochureSectionKey, string[]>();

    batch.forEach((passage, index) => {
      const answer = answers[`c${index}`];
      if (
        !answer ||
        answer.type !== 'choice' ||
        answer.choice === 'skip' ||
        answer.confidence < MIN_CONFIDENCE ||
        !isBrochureSectionKey(answer.choice)
      ) {
        return;
      }
      const list = bySection.get(answer.choice) ?? [];
      list.push(passage);
      bySection.set(answer.choice, list);
    });

    const passages: BrochureMappedPassage[] = [];
    for (const sectionKey of BROCHURE_SECTION_KEYS) {
      const parts = bySection.get(sectionKey);
      if (!parts?.length) continue;
      const exactText = parts.join('\n\n').trim();
      passages.push({
        sectionKey,
        exactText,
        // Rewrite is filled by Gemini (or left as exact until then).
        rewrittenText: exactText,
      });
    }

    return passages;
  } catch (error) {
    console.error(
      '[jev-brochure-section-triage] falling back',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
