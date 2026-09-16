import { z } from 'zod';

import {
  createCampaignBlockId,
  isSafeHttpUrl,
  stripHtmlToText,
} from '~/lib/campaigns/campaign-document';

import {
  BUILDING_SURVEY_SECTIONS,
  type SurveyObservationInput,
  type SurveyPinnedPhotoInput,
  buildingSurveySectionByKey,
} from './report-sections';

export const SURVEY_REPORT_DOCUMENT_VERSION = 1 as const;
export const SURVEY_REPORT_DOCUMENT_MARKER =
  '<!-- ozer-survey-report-document:v1 -->';

export const SURVEY_REPORT_BLOCK_TYPES = [
  'heading',
  'text',
  'image',
  'divider',
] as const;

export type SurveyReportBlockType = (typeof SURVEY_REPORT_BLOCK_TYPES)[number];

export type SurveyReportBlock =
  | {
      id: string;
      type: 'heading';
      text: string;
      level: 1 | 2;
      sectionKey?: string;
    }
  | {
      id: string;
      type: 'text';
      html: string;
    }
  | {
      id: string;
      type: 'image';
      src: string;
      alt: string;
      caption?: string;
      documentId?: string;
      sectionKey?: string;
    }
  | {
      id: string;
      type: 'divider';
    };

export type SurveyReportDocument = {
  version: typeof SURVEY_REPORT_DOCUMENT_VERSION;
  blocks: SurveyReportBlock[];
};

export const SurveyReportBlockSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('heading'),
    text: z.string().max(500),
    level: z.union([z.literal(1), z.literal(2)]),
    sectionKey: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('text'),
    html: z.string().max(40_000),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('image'),
    src: z.string().max(2_000),
    alt: z.string().max(200),
    caption: z.string().max(1_000).optional(),
    documentId: z.string().uuid().optional(),
    sectionKey: z.string().max(80).optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('divider'),
  }),
]);

export const SurveyReportDocumentSchema = z.object({
  version: z.literal(SURVEY_REPORT_DOCUMENT_VERSION),
  blocks: z.array(SurveyReportBlockSchema).max(200),
});

export const SURVEY_REPORT_BLOCK_LIBRARY: Array<{
  type: SurveyReportBlockType;
  label: string;
  description: string;
}> = [
  { type: 'heading', label: 'Heading', description: 'Section title' },
  { type: 'text', label: 'Text', description: 'Report paragraph' },
  { type: 'image', label: 'Image', description: 'Photo with caption' },
  { type: 'divider', label: 'Divider', description: 'Horizontal rule' },
];

export function createSurveyReportBlockId(): string {
  return createCampaignBlockId();
}

export function createSurveyReportBlock(
  type: SurveyReportBlockType,
): SurveyReportBlock {
  const id = createSurveyReportBlockId();

  switch (type) {
    case 'heading':
      return { id, type, text: 'Section heading', level: 2 };
    case 'text':
      return { id, type, html: '<p></p>' };
    case 'image':
      return { id, type, src: '', alt: '', caption: '' };
    case 'divider':
      return { id, type };
  }
}

export function parseSurveyReportDocument(
  value: unknown,
): SurveyReportDocument | null {
  const parsed = SurveyReportDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isSurveyReportDocumentHtml(html: string): boolean {
  return html.includes(SURVEY_REPORT_DOCUMENT_MARKER);
}

export function blankSurveyReportDocument(): SurveyReportDocument {
  return {
    version: SURVEY_REPORT_DOCUMENT_VERSION,
    blocks: BUILDING_SURVEY_SECTIONS.flatMap((section) => [
      {
        id: createSurveyReportBlockId(),
        type: 'heading' as const,
        text: section.heading,
        level: 2 as const,
        sectionKey: section.key,
      },
      {
        id: createSurveyReportBlockId(),
        type: 'text' as const,
        html: '<p></p>',
      },
    ]),
  };
}

export function paragraphsToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join('\n');
}

export function documentFromObservations(
  observations: SurveyObservationInput[],
  photos: Array<
    SurveyPinnedPhotoInput & {
      documentId?: string;
      url?: string | null;
    }
  > = [],
): SurveyReportDocument {
  const blocks: SurveyReportBlock[] = [];

  for (const section of BUILDING_SURVEY_SECTIONS) {
    const bodies = observations
      .filter((item) => item.sectionKey === section.key)
      .map((item) => item.body.trim())
      .filter(Boolean);
    const sectionPhotos = photos.filter(
      (photo) => photo.sectionKey === section.key,
    );

    blocks.push({
      id: createSurveyReportBlockId(),
      type: 'heading',
      text: section.heading,
      level: 2,
      sectionKey: section.key,
    });

    if (bodies.length > 0) {
      blocks.push({
        id: createSurveyReportBlockId(),
        type: 'text',
        html: bodies.map((body) => paragraphsToHtml(body)).join('\n'),
      });
    } else {
      blocks.push({
        id: createSurveyReportBlockId(),
        type: 'text',
        html: '<p></p>',
      });
    }

    for (const photo of sectionPhotos) {
      const caption = photo.caption?.trim() || photo.title;
      blocks.push({
        id: createSurveyReportBlockId(),
        type: 'image',
        src: photo.url?.trim() || '',
        alt: caption,
        caption,
        documentId: photo.documentId,
        sectionKey: section.key,
      });
    }
  }

  return { version: SURVEY_REPORT_DOCUMENT_VERSION, blocks };
}

export function documentFromSectionHtml(
  sections: Array<{ key: string; html: string }>,
  photos: Array<
    SurveyPinnedPhotoInput & {
      documentId?: string;
      url?: string | null;
    }
  > = [],
): SurveyReportDocument {
  const byKey = new Map(
    sections.map((section) => [section.key, section.html.trim()]),
  );
  const blocks: SurveyReportBlock[] = [];

  for (const section of BUILDING_SURVEY_SECTIONS) {
    const html = byKey.get(section.key)?.trim() || '<p></p>';
    const sectionPhotos = photos.filter(
      (photo) => photo.sectionKey === section.key,
    );

    blocks.push({
      id: createSurveyReportBlockId(),
      type: 'heading',
      text: section.heading,
      level: 2,
      sectionKey: section.key,
    });
    blocks.push({
      id: createSurveyReportBlockId(),
      type: 'text',
      html: html || '<p></p>',
    });

    for (const photo of sectionPhotos) {
      const caption = photo.caption?.trim() || photo.title;
      blocks.push({
        id: createSurveyReportBlockId(),
        type: 'image',
        src: photo.url?.trim() || '',
        alt: caption,
        caption,
        documentId: photo.documentId,
        sectionKey: section.key,
      });
    }
  }

  return { version: SURVEY_REPORT_DOCUMENT_VERSION, blocks };
}

/**
 * Import legacy survey HTML (h2[data-section] + paragraphs) into blocks.
 */
export function importHtmlAsSurveyDocument(html: string): SurveyReportDocument {
  const trimmed = html.trim();
  if (!trimmed) return blankSurveyReportDocument();

  const headingPattern = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  const matches = [...trimmed.matchAll(headingPattern)];

  if (matches.length === 0) {
    return {
      version: SURVEY_REPORT_DOCUMENT_VERSION,
      blocks: [
        {
          id: createSurveyReportBlockId(),
          type: 'text',
          html: trimmed,
        },
      ],
    };
  }

  const blocks: SurveyReportBlock[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match) continue;
    const attrs = match[1] ?? '';
    const headingText = stripHtmlToText(match[2] ?? '').trim();
    const sectionKey =
      /data-section=["']([^"']+)["']/i.exec(attrs)?.[1] ??
      buildingSurveySectionByKeyFromHeading(headingText);

    const start = (match.index ?? 0) + match[0].length;
    const next = matches[index + 1];
    const end = next?.index ?? trimmed.length;
    const bodyHtml = trimmed.slice(start, end).trim() || '<p></p>';

    blocks.push({
      id: createSurveyReportBlockId(),
      type: 'heading',
      text:
        headingText ||
        buildingSurveySectionByKey(sectionKey ?? '')?.heading ||
        'Section',
      level: 2,
      sectionKey: sectionKey,
    });
    blocks.push({
      id: createSurveyReportBlockId(),
      type: 'text',
      html: bodyHtml,
    });
  }

  return { version: SURVEY_REPORT_DOCUMENT_VERSION, blocks };
}

function buildingSurveySectionByKeyFromHeading(
  heading: string,
): string | undefined {
  const normalized = heading.trim().toLowerCase();
  return BUILDING_SURVEY_SECTIONS.find(
    (section) => section.heading.toLowerCase() === normalized,
  )?.key;
}

export function resolveSurveyReportDocument(
  stored: unknown,
  htmlBody: string,
): SurveyReportDocument {
  const parsed = parseSurveyReportDocument(stored);
  if (parsed && parsed.blocks.length > 0) {
    return parsed;
  }

  if (!htmlBody.trim()) {
    return blankSurveyReportDocument();
  }

  return importHtmlAsSurveyDocument(htmlBody);
}

export function updateSurveyReportBlock(
  document: SurveyReportDocument,
  blockId: string,
  patch: Partial<SurveyReportBlock>,
): SurveyReportDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) =>
      block.id === blockId
        ? ({
            ...block,
            ...patch,
            id: block.id,
            type: block.type,
          } as SurveyReportBlock)
        : block,
    ),
  };
}

export function insertSurveyReportBlock(
  document: SurveyReportDocument,
  block: SurveyReportBlock,
  afterId?: string | null,
): SurveyReportDocument {
  const blocks = [...document.blocks];
  const afterIndex = afterId
    ? blocks.findIndex((item) => item.id === afterId)
    : -1;
  const insertAt = afterIndex >= 0 ? afterIndex + 1 : blocks.length;
  blocks.splice(insertAt, 0, block);
  return { ...document, blocks };
}

export function removeSurveyReportBlock(
  document: SurveyReportDocument,
  blockId: string,
): SurveyReportDocument {
  return {
    ...document,
    blocks: document.blocks.filter((block) => block.id !== blockId),
  };
}

export function duplicateSurveyReportBlock(
  document: SurveyReportDocument,
  blockId: string,
): SurveyReportDocument {
  const index = document.blocks.findIndex((block) => block.id === blockId);
  const source = document.blocks[index];
  if (!source) return document;

  const clone = {
    ...source,
    id: createSurveyReportBlockId(),
  } as SurveyReportBlock;
  const blocks = [...document.blocks];
  blocks.splice(index + 1, 0, clone);
  return { ...document, blocks };
}

export function moveSurveyReportBlock(
  document: SurveyReportDocument,
  blockId: string,
  direction: -1 | 1,
): SurveyReportDocument {
  const index = document.blocks.findIndex((block) => block.id === blockId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= document.blocks.length) {
    return document;
  }

  const blocks = [...document.blocks];
  const [moved] = blocks.splice(index, 1);
  if (!moved) return document;
  blocks.splice(next, 0, moved);
  return { ...document, blocks };
}

export function reorderSurveyReportBlocks(
  document: SurveyReportDocument,
  activeId: string,
  overId: string,
): SurveyReportDocument {
  const from = document.blocks.findIndex((block) => block.id === activeId);
  const to = document.blocks.findIndex((block) => block.id === overId);
  if (from < 0 || to < 0 || from === to) return document;

  const blocks = [...document.blocks];
  const [moved] = blocks.splice(from, 1);
  if (!moved) return document;
  blocks.splice(to, 0, moved);
  return { ...document, blocks };
}

export function surveyReportDocumentHasContent(
  document: SurveyReportDocument,
): boolean {
  return document.blocks.some((block) => {
    switch (block.type) {
      case 'heading':
        return block.text.trim().length > 0;
      case 'text':
        return stripHtmlToText(block.html).length > 0;
      case 'image':
        return Boolean(block.src.trim() || block.documentId);
      default:
        return false;
    }
  });
}

export function hydrateSurveyReportImageSrcs(
  document: SurveyReportDocument,
  urlsByDocumentId: Record<string, string>,
): SurveyReportDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => {
      if (block.type !== 'image' || !block.documentId) return block;
      const src = urlsByDocumentId[block.documentId];
      return src ? { ...block, src } : block;
    }),
  };
}

export { isSafeHttpUrl };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
