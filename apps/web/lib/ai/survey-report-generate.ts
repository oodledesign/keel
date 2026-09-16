import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';
import { parseGeneratedDocument } from '~/lib/ai/survey-report-generate-parse';
import { compileSurveyReportDocument } from '~/lib/building-surveyor/compile-survey-report-document';
import {
  BUILDING_SURVEY_SECTIONS,
  type SurveyObservationInput,
  type SurveyPinnedPhotoInput,
  buildingSurveySectionListForPrompt,
  routeTranscriptToSections,
} from '~/lib/building-surveyor/report-sections';
import {
  type SurveyReportDocument,
  documentFromObservations,
  documentFromSectionHtml,
} from '~/lib/building-surveyor/survey-report-document';
import { buildingSurveyTypeLabel } from '~/lib/building-surveyor/survey-types';

export type SurveyTranscript = {
  title: string;
  content: string;
};

export type SurveyGenerateParams = {
  propertyLabel: string;
  clientName?: string | null;
  accountName: string;
  surveyorName: string;
  transcripts: SurveyTranscript[];
  contextNotes?: Array<{ title: string; content: string; type: string }>;
  observations?: SurveyObservationInput[];
  pinnedPhotos?: SurveyPinnedPhotoInput[];
  surveyType?: string | null;
  styleGuidance?: string | null;
};

export type SurveyGenerateResult = {
  document: SurveyReportDocument;
  contentHtml: string;
  source: 'ai' | 'keyword_fallback';
  fallbackReason?: string;
};

const SURVEY_SYSTEM_PROMPT = `You write UK building survey / RICS Home Survey report drafts for a chartered surveying firm.

Output ONLY valid JSON — no markdown fences, no HTML wrapper document.

{
  "sections": [
    { "key": "about_inspection", "html": "<p>...</p>" }
  ]
}

Use these section keys. Keep heading text out of the html — the app adds headings.

${buildingSurveySectionListForPrompt()}

Rules:
- British English. Professional, factual, cautious. Do not invent defects.
- Route findings to the matching section even when they appear out of order in the transcript (e.g. windows mentioned across several bedrooms belong under Windows).
- Mentions of the same element in different rooms should be combined in that element's section.
- Where the transcript does not mention a section, use an empty string or omit the section.
- html may use only p, ul, li, strong, em — no images, tables, or inline styles.
- Do not add Go Report or RICS Pro Forms branding.
- Do not wrap output in markdown fences.
- Include standard RICS Home Survey boilerplate only under "rics_description".
- Do not invent photograph references. Curated photos are placed by the app after each section.
- When style guidance is provided, match that surveyor's phrasing, sentence length, and recommendation tone. Do not copy property facts from the style examples.`;

function groupedObservationsForPrompt(params: SurveyGenerateParams) {
  const observations = params.observations ?? [];
  if (observations.length === 0) return '(none provided)';

  return BUILDING_SURVEY_SECTIONS.map((section) => {
    const items = observations
      .filter((item) => item.sectionKey === section.key)
      .map((item) => item.body.trim())
      .filter(Boolean);
    if (items.length === 0) return null;
    return `### ${section.heading} (${section.key})\n${items.join('\n\n')}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

function pinnedPhotosForPrompt(params: SurveyGenerateParams) {
  const photos = params.pinnedPhotos ?? [];
  if (photos.length === 0) return '(none provided)';

  return photos
    .map((photo) => {
      const caption = photo.caption?.trim();
      return `- [${photo.sectionKey}] ${photo.title}${
        caption ? ` — ${caption}` : ''
      }${photo.documentId ? ` (doc:${photo.documentId})` : ''}`;
    })
    .join('\n');
}

function buildUserPayload(params: SurveyGenerateParams) {
  const transcripts = params.transcripts
    .map(
      (t, i) =>
        `### Transcript ${i + 1}: ${t.title}\n${t.content.slice(0, 40_000)}`,
    )
    .join('\n\n');

  const notes = (params.contextNotes ?? [])
    .map(
      (n, i) =>
        `### ${n.type} ${i + 1}: ${n.title}\n${n.content.slice(0, 40_000)}`,
    )
    .join('\n\n');

  return JSON.stringify({
    property: params.propertyLabel,
    client_name: params.clientName?.trim() || null,
    workspace_name: params.accountName,
    surveyor_name: params.surveyorName,
    survey_type: buildingSurveyTypeLabel(params.surveyType),
    grouped_observations:
      groupedObservationsForPrompt(params) || '(none provided)',
    pinned_photos: pinnedPhotosForPrompt(params),
    site_transcripts: transcripts || '(none provided)',
    notes_and_files_context: notes || '(none provided)',
    required_section_count: BUILDING_SURVEY_SECTIONS.length,
    style_guidance:
      params.styleGuidance?.trim() ||
      '(none — write in a clear RICS Home Survey voice)',
    instruction:
      'Prefer the grouped observations over raw transcripts when both are present. Write section html only. Curated photos are attached after each matching section by the app — mention the defect, not a fake image tag. Match the style guidance.',
  });
}

function fallbackDocument(params: SurveyGenerateParams): SurveyReportDocument {
  if ((params.observations?.length ?? 0) > 0) {
    return documentFromObservations(
      params.observations ?? [],
      params.pinnedPhotos ?? [],
    );
  }

  const combined = params.transcripts
    .map((t) => t.content)
    .concat((params.contextNotes ?? []).map((n) => n.content))
    .join('\n\n');
  const routed = routeTranscriptToSections(combined);
  return documentFromSectionHtml(
    BUILDING_SURVEY_SECTIONS.map((section) => ({
      key: section.key,
      html: routed[section.key]?.trim()
        ? `<p>${escapeHtml(routed[section.key] ?? '')}</p>`
        : '<p></p>',
    })),
    params.pinnedPhotos ?? [],
  );
}

function resultFromDocument(
  document: SurveyReportDocument,
  source: SurveyGenerateResult['source'],
  fallbackReason?: string,
): SurveyGenerateResult {
  return {
    document,
    contentHtml: compileSurveyReportDocument(document),
    source,
    fallbackReason,
  };
}

/**
 * Draft a building survey from pasted/uploaded site transcripts.
 * Falls back to keyword section-routing when AI keys or credits are unavailable.
 */
export async function generateSurveyReportHtml(
  params: SurveyGenerateParams,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<SurveyGenerateResult> {
  if (
    params.transcripts.length === 0 &&
    (params.contextNotes?.length ?? 0) === 0 &&
    (params.observations?.length ?? 0) === 0
  ) {
    throw new Error(
      'Provide at least one site transcript, grouped observation, or note',
    );
  }

  try {
    const text = await callAI({
      feature: 'proposal_generate',
      systemPrompt: SURVEY_SYSTEM_PROMPT,
      userPrompt: buildUserPayload(params),
      accountId: meter.accountId,
      supabase: meter.supabase,
    });
    const document = parseGeneratedDocument(
      text ?? '',
      params.pinnedPhotos ?? [],
    );
    if (!document) {
      return resultFromDocument(
        fallbackDocument(params),
        'keyword_fallback',
        'The model returned an incomplete draft, so sections were filled from keyword routing.',
      );
    }
    return resultFromDocument(document, 'ai');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'AI draft unavailable';
    return resultFromDocument(
      fallbackDocument(params),
      'keyword_fallback',
      message,
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
