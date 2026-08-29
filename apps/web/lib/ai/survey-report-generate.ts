import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';
import {
  BUILDING_SURVEY_SECTIONS,
  buildingSurveySectionListForPrompt,
  htmlFromRoutedSections,
  routeTranscriptToSections,
} from '~/lib/building-surveyor/report-sections';

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
};

export type SurveyGenerateResult = {
  contentHtml: string;
  source: 'ai' | 'keyword_fallback';
  fallbackReason?: string;
};

const SURVEY_SYSTEM_PROMPT = `You write UK building survey / RICS Home Survey report drafts for a chartered surveying firm.

Output ONLY the report body as simple HTML fragments — no <!DOCTYPE>, <html>, <head>, or <body> wrapper.

Use these sections in order, each as an <h2 data-section="KEY"> heading followed by <p> content.
Keep the heading text exactly as given. Put data-section on every h2.

${buildingSurveySectionListForPrompt()}

Rules:
- British English. Professional, factual, cautious. Do not invent defects.
- Route findings to the matching section even when they appear out of order in the transcript (e.g. windows mentioned across several bedrooms belong under Windows).
- Mentions of the same element in different rooms should be combined in that element's section.
- Where the transcript does not mention a section, leave a single empty <p></p> under that heading.
- Use only h2, p, ul, li, strong, em — no tables or inline styles.
- Do not add Go Report or RICS Pro Forms branding.
- Do not wrap output in markdown fences.
- Include standard RICS Home Survey boilerplate only under "Description of the RICS Home Survey".`;

function stripMarkdownFences(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
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
    site_transcripts: transcripts || '(none provided)',
    notes_and_files_context: notes || '(none provided)',
    required_section_count: BUILDING_SURVEY_SECTIONS.length,
  });
}

function fallbackHtml(params: SurveyGenerateParams): string {
  const combined = params.transcripts
    .map((t) => t.content)
    .concat((params.contextNotes ?? []).map((n) => n.content))
    .join('\n\n');
  return htmlFromRoutedSections(routeTranscriptToSections(combined));
}

function htmlLooksLikeSurvey(html: string): boolean {
  const headingCount = (html.match(/<h2/gi) ?? []).length;
  return headingCount >= 8;
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
    (params.contextNotes?.length ?? 0) === 0
  ) {
    throw new Error('Provide at least one site transcript or note');
  }

  try {
    const text = await callAI({
      feature: 'proposal_generate',
      systemPrompt: SURVEY_SYSTEM_PROMPT,
      userPrompt: buildUserPayload(params),
      accountId: meter.accountId,
      supabase: meter.supabase,
    });
    const html = stripMarkdownFences(text ?? '');
    if (!htmlLooksLikeSurvey(html)) {
      return {
        contentHtml: fallbackHtml(params),
        source: 'keyword_fallback',
        fallbackReason:
          'The model returned an incomplete draft, so sections were filled from keyword routing.',
      };
    }
    return { contentHtml: html, source: 'ai' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'AI draft unavailable';
    return {
      contentHtml: fallbackHtml(params),
      source: 'keyword_fallback',
      fallbackReason: message,
    };
  }
}
