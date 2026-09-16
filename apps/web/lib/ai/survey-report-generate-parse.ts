import { extractJsonObject } from '~/lib/ai/extract-json-object';
import {
  type SurveyPinnedPhotoInput,
  buildingSurveySectionByKey,
} from '~/lib/building-surveyor/report-sections';
import {
  type SurveyReportDocument,
  documentFromSectionHtml,
  importHtmlAsSurveyDocument,
  surveyReportDocumentHasContent,
} from '~/lib/building-surveyor/survey-report-document';

export function documentLooksLikeSurvey(
  document: SurveyReportDocument,
): boolean {
  const headingCount = document.blocks.filter(
    (block) => block.type === 'heading',
  ).length;
  return headingCount >= 8 && surveyReportDocumentHasContent(document);
}

export function stripMarkdownFences(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:html|json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

export function parseGeneratedDocument(
  text: string,
  photos: SurveyPinnedPhotoInput[],
): SurveyReportDocument | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('<') || trimmed.includes('<h2')) {
    const imported = importHtmlAsSurveyDocument(stripMarkdownFences(trimmed));
    return documentLooksLikeSurvey(imported) ? imported : null;
  }

  try {
    const parsed = JSON.parse(extractJsonObject(trimmed)) as {
      sections?: Array<{ key?: string; html?: string }>;
    };

    const sections = (parsed.sections ?? [])
      .filter(
        (section) =>
          typeof section.key === 'string' &&
          buildingSurveySectionByKey(section.key),
      )
      .map((section) => ({
        key: section.key as string,
        html: typeof section.html === 'string' ? section.html : '<p></p>',
      }));

    if (sections.length < 8) return null;

    const document = documentFromSectionHtml(sections, photos);
    return documentLooksLikeSurvey(document) ? document : null;
  } catch {
    return null;
  }
}
