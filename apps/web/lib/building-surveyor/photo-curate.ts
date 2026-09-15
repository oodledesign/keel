import {
  BUILDING_SURVEY_SECTIONS,
  bestSectionKeyForText,
  buildingSurveySectionByKey,
} from './report-sections';

export const MAX_CURATED_PHOTOS_PER_SECTION = 4;

export type SurveyPhotoCandidate = {
  id: string;
  title: string;
  createdAt?: string | null;
};

export type SurveyPhotoObservation = {
  sectionKey: string;
  body: string;
};

export type SurveyPhotoCuration = {
  docId: string;
  sectionKey: string;
  caption: string;
  sortOrder: number;
};

/**
 * Desk-side fallback when the AI curator is unavailable.
 * Scores photo titles against sections that already have observations.
 */
export function proposeCuratedPhotosHeuristic(input: {
  photos: SurveyPhotoCandidate[];
  observations: SurveyPhotoObservation[];
  maxPerSection?: number;
}): SurveyPhotoCuration[] {
  const maxPerSection = input.maxPerSection ?? MAX_CURATED_PHOTOS_PER_SECTION;
  const sectionsWithText = new Set(
    input.observations
      .filter((item) => item.body.trim())
      .map((item) => item.sectionKey),
  );

  const observationsBySection = new Map<string, string[]>();
  for (const observation of input.observations) {
    const body = observation.body.trim();
    if (!body) continue;
    const list = observationsBySection.get(observation.sectionKey) ?? [];
    list.push(body);
    observationsBySection.set(observation.sectionKey, list);
  }

  const used = new Set<string>();
  const result: SurveyPhotoCuration[] = [];

  for (const section of BUILDING_SURVEY_SECTIONS) {
    if (!sectionsWithText.has(section.key)) continue;

    const ranked = input.photos
      .filter((photo) => !used.has(photo.id))
      .map((photo) => ({
        photo,
        score: scorePhotoForSection(photo, section.key),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerSection);

    ranked.forEach((item, index) => {
      used.add(item.photo.id);
      result.push({
        docId: item.photo.id,
        sectionKey: section.key,
        caption: captionFromObservations(
          observationsBySection.get(section.key) ?? [],
          item.photo.title,
        ),
        sortOrder: index,
      });
    });
  }

  return result;
}

export function captionFromObservations(
  observations: string[],
  photoTitle: string,
): string {
  const first = observations.find((item) => item.length > 12);
  if (!first) {
    return photoTitle.trim() || 'Site photograph';
  }

  const sentence = first.split(/(?<=[.!?])\s+/)[0]?.trim() || first.trim();
  const caption = sentence.slice(0, 180).trim();
  return caption.endsWith('.') ? caption : `${caption}.`;
}

export function sanitisePhotoCuration(
  proposals: SurveyPhotoCuration[],
  photos: SurveyPhotoCandidate[],
  observations: SurveyPhotoObservation[],
  maxPerSection = MAX_CURATED_PHOTOS_PER_SECTION,
): SurveyPhotoCuration[] {
  const photoIds = new Set(photos.map((photo) => photo.id));
  const sectionsWithText = new Set(
    observations
      .filter((item) => item.body.trim())
      .map((item) => item.sectionKey),
  );
  const observationsBySection = new Map<string, string[]>();
  for (const observation of observations) {
    const body = observation.body.trim();
    if (!body) continue;
    const list = observationsBySection.get(observation.sectionKey) ?? [];
    list.push(body);
    observationsBySection.set(observation.sectionKey, list);
  }

  const perSection = new Map<string, number>();
  const used = new Set<string>();
  const result: SurveyPhotoCuration[] = [];

  for (const proposal of proposals) {
    if (!photoIds.has(proposal.docId) || used.has(proposal.docId)) continue;
    if (!buildingSurveySectionByKey(proposal.sectionKey)) continue;
    if (!sectionsWithText.has(proposal.sectionKey)) continue;

    const count = perSection.get(proposal.sectionKey) ?? 0;
    if (count >= maxPerSection) continue;

    const title =
      photos.find((photo) => photo.id === proposal.docId)?.title ??
      'Site photograph';
    const caption =
      proposal.caption.trim() ||
      captionFromObservations(
        observationsBySection.get(proposal.sectionKey) ?? [],
        title,
      );

    used.add(proposal.docId);
    perSection.set(proposal.sectionKey, count + 1);
    result.push({
      docId: proposal.docId,
      sectionKey: proposal.sectionKey,
      caption,
      sortOrder: count,
    });
  }

  return result;
}

function scorePhotoForSection(photo: SurveyPhotoCandidate, sectionKey: string) {
  const haystack = photo.title.toLowerCase();
  const section = buildingSurveySectionByKey(sectionKey);
  if (!section) return 0;

  let score = 0;
  if (haystack.includes(section.heading.toLowerCase())) score += 12;
  if (haystack.includes(section.key.replaceAll('_', ' '))) score += 8;
  for (const keyword of section.keywords) {
    if (haystack.includes(keyword)) score += keyword.length;
  }

  const titleGuess = bestSectionKeyForText(photo.title);
  if (titleGuess === sectionKey) score += 6;

  return score;
}
