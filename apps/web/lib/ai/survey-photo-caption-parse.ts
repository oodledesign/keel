import { extractJsonObject } from '~/lib/ai/extract-json-object';

export const SURVEY_PHOTO_CAPTION_SYSTEM_PROMPT = `You write short British English captions for UK building-survey photographs.

Return ONLY valid JSON:
{
  "captions": [
    { "docId": "<uuid>", "caption": "Cracked putty to the lower sash." }
  ]
}

Rules:
- Caption only the supplied photo ids.
- Ground the caption in the section observations. Do not invent defects.
- One sentence, under 140 characters.
- Do not assign or change a RICS section.
- Skip a photo if there is nothing grounded to say.`;

export type SurveyPhotoCaptionDraft = {
  docId: string;
  caption: string;
};

export function parseSurveyPhotoCaptions(
  text: string,
): SurveyPhotoCaptionDraft[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(extractJsonObject(trimmed)) as {
      captions?: Array<{ docId?: string; caption?: string }>;
    };
    return (parsed.captions ?? [])
      .map((item) => ({
        docId: typeof item.docId === 'string' ? item.docId.trim() : '',
        caption: typeof item.caption === 'string' ? item.caption.trim() : '',
      }))
      .filter((item) => item.docId && item.caption);
  } catch {
    return [];
  }
}

/** Keep surveyor-written captions. Fill only empty ones from the model. */
export function applyCaptionsIfEmpty<
  T extends { id: string; caption?: string | null },
>(photos: T[], drafts: SurveyPhotoCaptionDraft[]): Map<string, string> {
  const allowed = new Set(photos.map((photo) => photo.id));
  const alreadyCaptioned = new Set(
    photos
      .filter((photo) => Boolean(photo.caption?.trim()))
      .map((photo) => photo.id),
  );
  const next = new Map<string, string>();

  for (const draft of drafts) {
    if (!allowed.has(draft.docId)) continue;
    if (alreadyCaptioned.has(draft.docId)) continue;
    if (!draft.caption) continue;
    next.set(draft.docId, draft.caption.slice(0, 500));
  }

  return next;
}
