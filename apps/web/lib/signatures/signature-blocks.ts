export const SIGNATURE_BUILDER_VERSION = 1 as const;

export type SignatureLayout = 'stacked' | 'photo_left';

export type SignatureBlockType =
  | 'photo'
  | 'name'
  | 'title'
  | 'credentials'
  | 'email'
  | 'phone_direct'
  | 'phone_mobile'
  | 'website'
  | 'address'
  | 'department'
  | 'branch'
  | 'logo'
  | 'award_badge'
  | 'divider'
  | 'custom_text';

export type SignatureBlock = {
  id: string;
  type: SignatureBlockType;
  /** Only used by `custom_text` blocks. */
  text?: string;
};

export type SignatureBuilderDocument = {
  version: typeof SIGNATURE_BUILDER_VERSION;
  layout: SignatureLayout;
  blocks: SignatureBlock[];
};

export type SignatureBlockDefinition = {
  type: SignatureBlockType;
  label: string;
  description: string;
  /** Max instances allowed in one template (null = unlimited). */
  max: number | null;
};

export const SIGNATURE_BLOCK_LIBRARY: SignatureBlockDefinition[] = [
  {
    type: 'photo',
    label: 'Photo',
    description: 'Staff profile photo',
    max: 1,
  },
  {
    type: 'name',
    label: 'Full name',
    description: 'Primary name line',
    max: 1,
  },
  {
    type: 'title',
    label: 'Job title',
    description: 'Role / title',
    max: 1,
  },
  {
    type: 'credentials',
    label: 'Credentials',
    description: 'Letters after the name',
    max: 1,
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Underlined mailto link',
    max: 1,
  },
  {
    type: 'phone_direct',
    label: 'Direct phone',
    description: 'Office / direct line',
    max: 1,
  },
  {
    type: 'phone_mobile',
    label: 'Mobile phone',
    description: 'Mobile number',
    max: 1,
  },
  {
    type: 'website',
    label: 'Website',
    description: 'Company website link',
    max: 1,
  },
  {
    type: 'address',
    label: 'Address',
    description: 'Branch or company address',
    max: 1,
  },
  {
    type: 'department',
    label: 'Department',
    description: 'Team or department',
    max: 1,
  },
  {
    type: 'branch',
    label: 'Branch',
    description: 'Office / branch name',
    max: 1,
  },
  {
    type: 'logo',
    label: 'Company logo',
    description: 'Brand logo image',
    max: 1,
  },
  {
    type: 'award_badge',
    label: 'Award badge',
    description: 'Optional badge image',
    max: 1,
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'Subtle horizontal rule',
    max: null,
  },
  {
    type: 'custom_text',
    label: 'Custom text',
    description: 'Free text line',
    max: null,
  },
];

const BLOCK_BY_TYPE = Object.fromEntries(
  SIGNATURE_BLOCK_LIBRARY.map((item) => [item.type, item]),
) as Record<SignatureBlockType, SignatureBlockDefinition>;

export function getSignatureBlockDefinition(
  type: SignatureBlockType,
): SignatureBlockDefinition {
  return BLOCK_BY_TYPE[type];
}

export function createSignatureBlockId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSignatureBlock(
  type: SignatureBlockType,
  overrides?: Partial<Pick<SignatureBlock, 'text'>>,
): SignatureBlock {
  return {
    id: createSignatureBlockId(),
    type,
    ...(type === 'custom_text'
      ? { text: overrides?.text?.trim() || 'Add your text' }
      : {}),
  };
}

export function createMinimalSignatureDocument(): SignatureBuilderDocument {
  return {
    version: SIGNATURE_BUILDER_VERSION,
    layout: 'photo_left',
    blocks: [
      createSignatureBlock('photo'),
      createSignatureBlock('name'),
      createSignatureBlock('title'),
      createSignatureBlock('phone_direct'),
      createSignatureBlock('phone_mobile'),
      createSignatureBlock('email'),
    ],
  };
}

export function createExecutiveSignatureDocument(): SignatureBuilderDocument {
  return {
    version: SIGNATURE_BUILDER_VERSION,
    layout: 'photo_left',
    blocks: [
      createSignatureBlock('photo'),
      createSignatureBlock('name'),
      createSignatureBlock('credentials'),
      createSignatureBlock('title'),
      createSignatureBlock('email'),
      createSignatureBlock('website'),
      createSignatureBlock('address'),
      createSignatureBlock('logo'),
      createSignatureBlock('award_badge'),
      createSignatureBlock('phone_direct'),
      createSignatureBlock('phone_mobile'),
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function blockInnerHtml(block: SignatureBlock): string {
  switch (block.type) {
    case 'photo':
      return `<img src="{{photo_url}}" alt="{{full_name}}" width="80" height="80" style="display:block;width:80px;height:80px;border-radius:999px;object-fit:cover;border:0;" />`;
    case 'name':
      return `<div style="font-size:18px;font-weight:700;line-height:1.25;color:#333333;">{{full_name}}</div>`;
    case 'title':
      return `<div style="font-size:14px;line-height:1.4;color:#555555;">{{job_title}}</div>`;
    case 'credentials':
      return `<div style="font-size:13px;line-height:1.4;color:#555555;">{{credentials}}</div>`;
    case 'email':
      return `<div style="font-size:13px;line-height:1.5;color:#333333;"><a href="mailto:{{email}}" style="color:#333333;text-decoration:underline;">{{email}}</a></div>`;
    case 'phone_direct':
      return `<div style="font-size:13px;line-height:1.5;color:#333333;">{{phone_direct}}</div>`;
    case 'phone_mobile':
      return `<div style="font-size:13px;line-height:1.5;color:#333333;">{{phone_mobile}}</div>`;
    case 'website':
      return `<div style="font-size:13px;line-height:1.5;color:#333333;"><a href="{{website}}" style="color:#333333;text-decoration:underline;">{{website}}</a></div>`;
    case 'address':
      return `<div style="font-size:13px;line-height:1.5;color:#333333;">{{address}}</div>`;
    case 'department':
      return `<div style="font-size:13px;line-height:1.5;color:#555555;">{{department}}</div>`;
    case 'branch':
      return `<div style="font-size:13px;line-height:1.5;color:#555555;">{{branch}}</div>`;
    case 'logo':
      return `<img src="{{brand_logo_url}}" alt="" width="120" style="display:block;max-width:120px;height:auto;border:0;" />`;
    case 'award_badge':
      return `<img src="{{award_badge_url}}" alt="" width="96" style="display:block;max-width:96px;height:auto;border:0;" />`;
    case 'divider':
      return `<div style="border-top:1px solid #DDDDDD;line-height:0;font-size:0;height:1px;">&nbsp;</div>`;
    case 'custom_text':
      return `<div style="font-size:13px;line-height:1.5;color:#333333;">${escapeHtml(block.text ?? '')}</div>`;
    default: {
      const _exhaustive: never = block.type;
      return _exhaustive;
    }
  }
}

function wrapBlock(block: SignatureBlock, padding = '0 0 6px 0'): string {
  return [
    `<!-- ozer-block id="${block.id}" type="${block.type}"${block.type === 'custom_text' ? ` text="${escapeHtml(block.text ?? '')}"` : ''} -->`,
    `<tr><td style="padding:${padding};vertical-align:top;">`,
    blockInnerHtml(block),
    `</td></tr>`,
    `<!-- /ozer-block -->`,
  ].join('\n');
}

function renderBlockTable(blocks: SignatureBlock[]): string {
  if (blocks.length === 0) {
    return '';
  }

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`,
    ...blocks.map((block, index) =>
      wrapBlock(block, index === blocks.length - 1 ? '0' : '0 0 6px 0'),
    ),
    `</table>`,
  ].join('\n');
}

/** Serialize a visual builder document to Outlook-safe HTML. */
export function signatureBlocksToHtml(doc: SignatureBuilderDocument): string {
  const header = `<!-- ozer-sig-builder:v${doc.version} layout="${doc.layout}" -->`;
  const footer = `<!-- /ozer-sig-builder -->`;

  if (doc.layout === 'photo_left') {
    const photo = doc.blocks.find((block) => block.type === 'photo');
    const rest = doc.blocks.filter((block) => block.type !== 'photo');

    const photoCell = photo
      ? [
          `<!-- ozer-block id="${photo.id}" type="photo" -->`,
          `<td style="padding:0 16px 0 0;vertical-align:top;width:80px;">`,
          blockInnerHtml(photo),
          `</td>`,
          `<!-- /ozer-block -->`,
        ].join('\n')
      : '';

    return [
      header,
      `<!-- Ozer Signatures — visual builder (dark-mode resilient) -->`,
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#333333;max-width:560px;">`,
      `<tr>`,
      photoCell,
      `<td style="vertical-align:top;color:#333333;">`,
      renderBlockTable(rest),
      `</td>`,
      `</tr>`,
      `</table>`,
      footer,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    header,
    `<!-- Ozer Signatures — visual builder (dark-mode resilient) -->`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#333333;max-width:560px;">`,
    `<tr><td style="vertical-align:top;color:#333333;">`,
    renderBlockTable(doc.blocks),
    `</td></tr>`,
    `</table>`,
    footer,
  ].join('\n');
}

const BUILDER_OPEN =
  /<!--\s*ozer-sig-builder:v(\d+)\s+layout="(stacked|photo_left)"\s*-->/i;
const BUILDER_CLOSE = /<!--\s*\/ozer-sig-builder\s*-->/i;
const BLOCK_OPEN =
  /<!--\s*ozer-block\s+id="([^"]+)"\s+type="([a-z_]+)"(?:\s+text="([^"]*)")?\s*-->/gi;

function unescapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

const KNOWN_TYPES = new Set(
  SIGNATURE_BLOCK_LIBRARY.map((item) => item.type),
);

/** Best-effort parse of builder HTML. Returns null if not builder-managed. */
export function htmlToSignatureBlocks(
  html: string,
): SignatureBuilderDocument | null {
  const open = html.match(BUILDER_OPEN);
  if (!open || !BUILDER_CLOSE.test(html)) {
    return null;
  }

  const version = Number(open[1]);
  const layout = open[2] as SignatureLayout;
  if (version !== SIGNATURE_BUILDER_VERSION) {
    return null;
  }

  const blocks: SignatureBlock[] = [];
  for (const match of html.matchAll(BLOCK_OPEN)) {
    const id = match[1];
    const type = match[2] as SignatureBlockType;
    const text = match[3];

    if (!id || !KNOWN_TYPES.has(type)) {
      continue;
    }

    blocks.push({
      id,
      type,
      ...(type === 'custom_text'
        ? { text: unescapeHtmlAttr(text ?? '') }
        : {}),
    });
  }

  if (blocks.length === 0) {
    return null;
  }

  return {
    version: SIGNATURE_BUILDER_VERSION,
    layout,
    blocks,
  };
}

export function isSignatureBuilderHtml(html: string): boolean {
  return BUILDER_OPEN.test(html) && BUILDER_CLOSE.test(html);
}

export function canAddSignatureBlock(
  blocks: SignatureBlock[],
  type: SignatureBlockType,
): boolean {
  const def = getSignatureBlockDefinition(type);
  if (def.max == null) {
    return true;
  }

  return blocks.filter((block) => block.type === type).length < def.max;
}

export const SIGNATURE_TEMPLATE_TOKENS = [
  'full_name',
  'credentials',
  'job_title',
  'department',
  'phone_direct',
  'phone_mobile',
  'email',
  'branch',
  'address',
  'photo_url',
  'website',
  'brand_logo_url',
  'award_badge_url',
  'brand_primary_color',
  'brand_secondary_color',
  'brand_accent_color',
] as const;
