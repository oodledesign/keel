import { z } from 'zod';

import type { CampaignFormLink } from './form-link';

export const CAMPAIGN_DOCUMENT_VERSION = 1 as const;
export const CAMPAIGN_DOCUMENT_MARKER = '<!-- ozer-campaign-document:v1 -->';

export const CAMPAIGN_BLOCK_TYPES = [
  'logo',
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'spacer',
  'columns',
  'footer',
  'html',
] as const;

export type CampaignBlockType = (typeof CAMPAIGN_BLOCK_TYPES)[number];

export type CampaignAlign = 'left' | 'center';

export type CampaignBrand = {
  primary_color: string;
  secondary_color?: string | null;
  accent_color?: string | null;
  logo_url: string | null;
  website_url?: string | null;
};

export type CampaignColumnContent =
  | { kind: 'text'; html: string }
  | { kind: 'image'; src: string; alt: string; href?: string };

export type CampaignBlock =
  | { id: string; type: 'logo'; align?: CampaignAlign }
  | {
      id: string;
      type: 'heading';
      text: string;
      level: 1 | 2;
      align?: CampaignAlign;
    }
  | { id: string; type: 'text'; html: string; align?: CampaignAlign }
  | {
      id: string;
      type: 'image';
      src: string;
      alt: string;
      href?: string;
    }
  | {
      id: string;
      type: 'button';
      label: string;
      href: string;
      align?: CampaignAlign;
    }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height: number }
  | {
      id: string;
      type: 'columns';
      left: CampaignColumnContent;
      right: CampaignColumnContent;
    }
  | { id: string; type: 'footer'; text: string }
  | { id: string; type: 'html'; html: string };

export type CampaignDocument = {
  version: typeof CAMPAIGN_DOCUMENT_VERSION;
  blocks: CampaignBlock[];
  formLink?: CampaignFormLink | null;
};

const AlignSchema = z.enum(['left', 'center']);

const ColumnContentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    html: z.string().max(20_000),
  }),
  z.object({
    kind: z.literal('image'),
    src: z.string().max(2_000),
    alt: z.string().max(200),
    href: z.string().max(2_000).optional(),
  }),
]);

export const CampaignBlockSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('logo'),
    align: AlignSchema.optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('heading'),
    text: z.string().max(500),
    level: z.union([z.literal(1), z.literal(2)]),
    align: AlignSchema.optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('text'),
    html: z.string().max(20_000),
    align: AlignSchema.optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('image'),
    src: z.string().max(2_000),
    alt: z.string().max(200),
    href: z.string().max(2_000).optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('button'),
    label: z.string().max(120),
    href: z.string().max(2_000),
    align: AlignSchema.optional(),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('divider'),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('spacer'),
    height: z.number().int().min(8).max(120),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('columns'),
    left: ColumnContentSchema,
    right: ColumnContentSchema,
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('footer'),
    text: z.string().max(1_000),
  }),
  z.object({
    id: z.string().min(1).max(80),
    type: z.literal('html'),
    html: z.string().max(180_000),
  }),
]);

const CampaignFormLinkSchema = z.object({
  formId: z.string().uuid(),
  shareToken: z.string().min(16).max(128),
  formName: z.string().min(1).max(160),
  prefillEmail: z.boolean(),
});

export const CampaignDocumentSchema = z.object({
  version: z.literal(CAMPAIGN_DOCUMENT_VERSION),
  blocks: z.array(CampaignBlockSchema).max(80),
  formLink: CampaignFormLinkSchema.nullable().optional(),
});

export const CAMPAIGN_BLOCK_LIBRARY: Array<{
  type: Exclude<CampaignBlockType, 'html'>;
  label: string;
  description: string;
}> = [
  { type: 'logo', label: 'Logo', description: 'Workspace logo header' },
  { type: 'heading', label: 'Heading', description: 'Large title' },
  { type: 'text', label: 'Text', description: 'Paragraph with formatting' },
  { type: 'image', label: 'Image', description: 'Hosted image URL' },
  { type: 'button', label: 'Button', description: 'Call to action' },
  { type: 'divider', label: 'Divider', description: 'Horizontal rule' },
  { type: 'spacer', label: 'Spacer', description: 'Vertical space' },
  { type: 'columns', label: '2 columns', description: 'Text or image pair' },
  { type: 'footer', label: 'Footer', description: 'Includes unsubscribe' },
];

const PLACEHOLDER_HTML = /^<p>\s*Write your email[.…]*\s*<\/p>$/i;

export function createCampaignBlockId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createCampaignBlock(type: CampaignBlockType): CampaignBlock {
  const id = createCampaignBlockId();

  switch (type) {
    case 'logo':
      return { id, type, align: 'left' };
    case 'heading':
      return {
        id,
        type,
        text: 'Hello {{first_name}}',
        level: 1,
        align: 'left',
      };
    case 'text':
      return {
        id,
        type,
        html: '<p>Write something your contacts will want to read.</p>',
        align: 'left',
      };
    case 'image':
      return { id, type, src: '', alt: '' };
    case 'button':
      return {
        id,
        type,
        label: 'Read more',
        href: '',
        align: 'center',
      };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, height: 24 };
    case 'columns':
      return {
        id,
        type,
        left: { kind: 'text', html: '<p>Left column</p>' },
        right: { kind: 'text', html: '<p>Right column</p>' },
      };
    case 'footer':
      return {
        id,
        type,
        text: 'You are receiving this because you subscribed to updates from this workspace.',
      };
    case 'html':
      return { id, type, html: '' };
  }
}

export function createStarterDocument(brand?: CampaignBrand): CampaignDocument {
  const website = brand?.website_url?.trim();
  const button = createCampaignBlock('button');

  if (button.type === 'button') {
    button.href = website && isSafeHttpUrl(website) ? website : '';
    button.label = website ? 'Visit our website' : 'Read more';
  }

  return {
    version: CAMPAIGN_DOCUMENT_VERSION,
    blocks: [
      createCampaignBlock('logo'),
      createCampaignBlock('heading'),
      createCampaignBlock('text'),
      button,
      createCampaignBlock('footer'),
    ],
  };
}

export function parseCampaignDocument(value: unknown): CampaignDocument | null {
  const parsed = CampaignDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isCampaignDocumentHtml(html: string): boolean {
  return html.includes(CAMPAIGN_DOCUMENT_MARKER);
}

export function importHtmlAsDocument(html: string): CampaignDocument {
  const trimmed = html.trim();

  if (!trimmed || PLACEHOLDER_HTML.test(trimmed)) {
    return createStarterDocument();
  }

  return {
    version: CAMPAIGN_DOCUMENT_VERSION,
    blocks: [
      { id: createCampaignBlockId(), type: 'html', html: trimmed },
      createCampaignBlock('footer'),
    ],
  };
}

export function resolveCampaignDocument(
  stored: unknown,
  htmlBody: string,
  brand?: CampaignBrand,
): CampaignDocument {
  const parsed = parseCampaignDocument(stored);
  if (parsed && parsed.blocks.length > 0) {
    return parsed;
  }

  if (!htmlBody.trim() || PLACEHOLDER_HTML.test(htmlBody.trim())) {
    return createStarterDocument(brand);
  }

  return importHtmlAsDocument(htmlBody);
}

export function updateCampaignBlock(
  document: CampaignDocument,
  blockId: string,
  patch: Partial<CampaignBlock>,
): CampaignDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) =>
      block.id === blockId
        ? ({
            ...block,
            ...patch,
            id: block.id,
            type: block.type,
          } as CampaignBlock)
        : block,
    ),
  };
}

export function insertCampaignBlock(
  document: CampaignDocument,
  block: CampaignBlock,
  afterId?: string | null,
): CampaignDocument {
  const blocks = [...document.blocks];
  const afterIndex = afterId
    ? blocks.findIndex((item) => item.id === afterId)
    : -1;

  if (block.type === 'footer') {
    blocks.push(block);
    return { ...document, blocks };
  }

  const lastFooterIndex = [...blocks]
    .reverse()
    .findIndex((item) => item.type === 'footer');
  const footerIndex =
    lastFooterIndex === -1 ? -1 : blocks.length - 1 - lastFooterIndex;

  let insertAt = afterIndex >= 0 ? afterIndex + 1 : blocks.length;

  if (footerIndex >= 0 && insertAt > footerIndex) {
    insertAt = footerIndex;
  }

  blocks.splice(insertAt, 0, block);
  return { ...document, blocks };
}

export function removeCampaignBlock(
  document: CampaignDocument,
  blockId: string,
): CampaignDocument {
  return {
    ...document,
    blocks: document.blocks.filter((block) => block.id !== blockId),
  };
}

export function duplicateCampaignBlock(
  document: CampaignDocument,
  blockId: string,
): CampaignDocument {
  const index = document.blocks.findIndex((block) => block.id === blockId);
  const source = document.blocks[index];
  if (!source) return document;

  const clone = { ...source, id: createCampaignBlockId() } as CampaignBlock;
  const blocks = [...document.blocks];
  blocks.splice(index + 1, 0, clone);
  return { ...document, blocks };
}

export function moveCampaignBlock(
  document: CampaignDocument,
  blockId: string,
  direction: -1 | 1,
): CampaignDocument {
  const index = document.blocks.findIndex((block) => block.id === blockId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= document.blocks.length) {
    return document;
  }

  const moving = document.blocks[index];
  const target = document.blocks[next];
  if (!moving || !target) return document;
  if (moving.type === 'footer' && target.type !== 'footer') return document;
  if (moving.type !== 'footer' && target.type === 'footer') return document;

  const blocks = [...document.blocks];
  const [moved] = blocks.splice(index, 1);
  if (!moved) return document;
  blocks.splice(next, 0, moved);
  return { ...document, blocks };
}

export function reorderCampaignBlocks(
  document: CampaignDocument,
  activeId: string,
  overId: string,
): CampaignDocument {
  const from = document.blocks.findIndex((block) => block.id === activeId);
  const to = document.blocks.findIndex((block) => block.id === overId);
  if (from < 0 || to < 0 || from === to) return document;

  const moving = document.blocks[from];
  const target = document.blocks[to];
  if (!moving || !target) return document;
  if (moving.type === 'footer' && target.type !== 'footer') return document;
  if (moving.type !== 'footer' && target.type === 'footer') return document;

  const blocks = [...document.blocks];
  const [moved] = blocks.splice(from, 1);
  if (!moved) return document;
  blocks.splice(to, 0, moved);
  return { ...document, blocks };
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function columnHasContent(column: CampaignColumnContent): boolean {
  if (column.kind === 'image') return Boolean(column.src.trim());
  return stripHtmlToText(column.html).length > 0;
}

export function campaignDocumentHasContent(
  document: CampaignDocument,
): boolean {
  return document.blocks.some((block) => {
    switch (block.type) {
      case 'heading':
        return block.text.trim().length > 0;
      case 'text':
        return stripHtmlToText(block.html).length > 0;
      case 'button':
        return block.label.trim().length > 0;
      case 'image':
        return Boolean(block.src.trim());
      case 'html':
        return stripHtmlToText(block.html).length > 0;
      case 'columns':
        return columnHasContent(block.left) || columnHasContent(block.right);
      case 'logo':
      case 'footer':
        return true;
      default:
        return false;
    }
  });
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}
