export const SIGNATURE_BUILDER_VERSION = 1 as const;

export type SignatureLayout = 'stacked' | 'photo_left';

export type SignatureBackgroundMode = 'none' | 'solid' | 'gradient';

/** Optional filled canvas for the signature (forces colours for light + dark inboxes). */
export type SignatureBackground = {
  mode: SignatureBackgroundMode;
  /** Solid fill, or gradient start. Hex `#RRGGBB`. */
  color: string;
  /** Gradient end when `mode === 'gradient'`. Hex `#RRGGBB`. */
  colorEnd?: string;
};

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
  background?: SignatureBackground;
  blocks: SignatureBlock[];
};

export const DEFAULT_SIGNATURE_BACKGROUND: SignatureBackground = {
  mode: 'none',
  color: '#FBF6EC',
  colorEnd: '#E7DECF',
};

type SignatureTextPalette = {
  primary: string;
  muted: string;
  link: string;
  divider: string;
};

const TRANSPARENT_PALETTE: SignatureTextPalette = {
  primary: '#333333',
  muted: '#555555',
  link: '#333333',
  divider: '#DDDDDD',
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
    background: { ...DEFAULT_SIGNATURE_BACKGROUND },
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
    background: { ...DEFAULT_SIGNATURE_BACKGROUND },
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

export function normalizeHexColor(
  value: string | null | undefined,
  fallback: string,
): string {
  const raw = (value ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex, '');
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/** Relative luminance 0–1 (sRGB). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
  );
}

export function resolveSignatureBackground(
  background?: SignatureBackground | null,
): SignatureBackground {
  const mode = background?.mode ?? 'none';
  const color = normalizeHexColor(
    background?.color,
    DEFAULT_SIGNATURE_BACKGROUND.color,
  );
  const colorEnd = normalizeHexColor(
    background?.colorEnd ?? color,
    DEFAULT_SIGNATURE_BACKGROUND.colorEnd ?? color,
  );
  return { mode, color, colorEnd };
}

/**
 * When a canvas is set, pick a light or dark text palette so the signature
 * reads the same in light and dark inboxes (colours are forced on the HTML).
 */
export function paletteForBackground(
  background?: SignatureBackground | null,
): SignatureTextPalette {
  const bg = resolveSignatureBackground(background);
  if (bg.mode === 'none') {
    return TRANSPARENT_PALETTE;
  }

  const a = relativeLuminance(bg.color);
  const b =
    bg.mode === 'gradient' ? relativeLuminance(bg.colorEnd ?? bg.color) : a;
  const luminance = (a + b) / 2;

  // Pick the palette with better contrast against the canvas (approx. WCAG).
  const darkTextL = 0.04; // ~#333333
  const lightTextL = 0.9; // ~#F3F4F6
  const darkContrast = (luminance + 0.05) / (darkTextL + 0.05);
  const lightContrast = (lightTextL + 0.05) / (luminance + 0.05);

  if (lightContrast >= darkContrast) {
    return {
      primary: '#F3F4F6',
      muted: '#D1D5DB',
      link: '#F3F4F6',
      divider: '#6B7280',
    };
  }

  return {
    primary: '#333333',
    muted: '#555555',
    link: '#333333',
    divider: '#DDDDDD',
  };
}

function serializeBackgroundAttr(background?: SignatureBackground | null): string {
  const bg = resolveSignatureBackground(background);
  if (bg.mode === 'none') {
    return '';
  }
  if (bg.mode === 'solid') {
    return ` bg="solid:${bg.color}"`;
  }
  return ` bg="gradient:${bg.color}:${bg.colorEnd ?? bg.color}"`;
}

export function parseBackgroundAttr(
  value: string | undefined,
): SignatureBackground {
  if (!value || value === 'none') {
    return { ...DEFAULT_SIGNATURE_BACKGROUND, mode: 'none' };
  }

  if (value.startsWith('solid:')) {
    return {
      mode: 'solid',
      color: normalizeHexColor(value.slice('solid:'.length), '#FFFFFF'),
    };
  }

  if (value.startsWith('gradient:')) {
    const rest = value.slice('gradient:'.length);
    const [start, end] = rest.split(':');
    return {
      mode: 'gradient',
      color: normalizeHexColor(start, '#FBF6EC'),
      colorEnd: normalizeHexColor(end, '#E7DECF'),
    };
  }

  return { ...DEFAULT_SIGNATURE_BACKGROUND, mode: 'none' };
}

function canvasShellStyles(background: SignatureBackground): {
  bgcolor: string | null;
  style: string;
  forceCanvas: boolean;
  /** Inner cell padding when a painted canvas is present (email-safe). */
  canvasPadding: string | null;
} {
  const bg = resolveSignatureBackground(background);
  if (bg.mode === 'none') {
    return {
      bgcolor: null,
      style:
        'border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#333333;max-width:560px;',
      forceCanvas: false,
      canvasPadding: null,
    };
  }

  const palette = paletteForBackground(bg);
  const gradient =
    bg.mode === 'gradient'
      ? `background-image:linear-gradient(135deg,${bg.color},${bg.colorEnd ?? bg.color})`
      : 'background-image:none';

  // color-scheme:light only — ask clients not to invert fills/text when a
  // deliberate canvas is present. bgcolor remains the solid fallback (Outlook).
  // Padding belongs on the inner <td> — table padding is ignored in most clients.
  return {
    bgcolor: bg.color,
    style: [
      'border-collapse:collapse',
      'font-family:Arial,Helvetica,sans-serif',
      `color:${palette.primary}`,
      'max-width:560px',
      `background-color:${bg.color}`,
      gradient,
      'border-radius:8px',
      'color-scheme:light only',
    ].join(';'),
    forceCanvas: true,
    canvasPadding: '16px',
  };
}

function blockInnerHtml(
  block: SignatureBlock,
  palette: SignatureTextPalette,
): string {
  switch (block.type) {
    case 'photo':
      return `<img src="{{photo_url}}" alt="{{full_name}}" width="80" height="80" style="display:block;width:80px;height:80px;border-radius:999px;object-fit:cover;border:0;" />`;
    case 'name':
      return `<div style="font-size:18px;font-weight:700;line-height:1.25;color:${palette.primary};">{{full_name}}</div>`;
    case 'title':
      return `<div style="font-size:14px;line-height:1.4;color:${palette.muted};">{{job_title}}</div>`;
    case 'credentials':
      return `<div style="font-size:13px;line-height:1.4;color:${palette.muted};">{{credentials}}</div>`;
    case 'email':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.primary};"><a href="mailto:{{email}}" style="color:${palette.link};text-decoration:underline;">{{email}}</a></div>`;
    case 'phone_direct':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.primary};">{{phone_direct}}</div>`;
    case 'phone_mobile':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.primary};">{{phone_mobile}}</div>`;
    case 'website':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.primary};"><a href="{{website}}" style="color:${palette.link};text-decoration:underline;">{{website}}</a></div>`;
    case 'address':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.primary};">{{address}}</div>`;
    case 'department':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.muted};">{{department}}</div>`;
    case 'branch':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.muted};">{{branch}}</div>`;
    case 'logo':
      return `<img src="{{brand_logo_url}}" alt="" width="120" style="display:block;max-width:120px;height:auto;border:0;" />`;
    case 'award_badge':
      return `<img src="{{award_badge_url}}" alt="" width="96" style="display:block;max-width:96px;height:auto;border:0;" />`;
    case 'divider':
      return `<div style="border-top:1px solid ${palette.divider};line-height:0;font-size:0;height:1px;">&nbsp;</div>`;
    case 'custom_text':
      return `<div style="font-size:13px;line-height:1.5;color:${palette.primary};">${escapeHtml(block.text ?? '')}</div>`;
    default: {
      const _exhaustive: never = block.type;
      return _exhaustive;
    }
  }
}

function wrapBlock(
  block: SignatureBlock,
  palette: SignatureTextPalette,
  padding = '0 0 6px 0',
): string {
  return [
    `<!-- ozer-block id="${block.id}" type="${block.type}"${block.type === 'custom_text' ? ` text="${escapeHtml(block.text ?? '')}"` : ''} -->`,
    `<tr><td style="padding:${padding};vertical-align:top;">`,
    blockInnerHtml(block, palette),
    `</td></tr>`,
    `<!-- /ozer-block -->`,
  ].join('\n');
}

function renderBlockTable(
  blocks: SignatureBlock[],
  palette: SignatureTextPalette,
): string {
  if (blocks.length === 0) {
    return '';
  }

  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`,
    ...blocks.map((block, index) =>
      wrapBlock(
        block,
        palette,
        index === blocks.length - 1 ? '0' : '0 0 6px 0',
      ),
    ),
    `</table>`,
  ].join('\n');
}

/** Serialize a visual builder document to Outlook-safe HTML. */
export function signatureBlocksToHtml(doc: SignatureBuilderDocument): string {
  const background = resolveSignatureBackground(doc.background);
  const palette = paletteForBackground(background);
  const shell = canvasShellStyles(background);
  const header = `<!-- ozer-sig-builder:v${doc.version} layout="${doc.layout}"${serializeBackgroundAttr(background)} -->`;
  const footer = `<!-- /ozer-sig-builder -->`;
  const note = shell.forceCanvas
    ? `<!-- Ozer Signatures — visual builder (forced canvas colours) -->`
    : `<!-- Ozer Signatures — visual builder (dark-mode resilient) -->`;
  const tableOpen = shell.bgcolor
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${shell.bgcolor}" style="${shell.style}">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${shell.style}">`;

  const photoPad = shell.canvasPadding
    ? `${shell.canvasPadding} 16px ${shell.canvasPadding} ${shell.canvasPadding}`
    : '0 16px 0 0';
  const contentPad = shell.canvasPadding
    ? `${shell.canvasPadding} ${shell.canvasPadding} ${shell.canvasPadding} 0`
    : '0';
  const stackedPad = shell.canvasPadding ?? '0';

  let body: string;

  if (doc.layout === 'photo_left') {
    const photo = doc.blocks.find((block) => block.type === 'photo');
    const rest = doc.blocks.filter((block) => block.type !== 'photo');

    const photoCell = photo
      ? [
          `<!-- ozer-block id="${photo.id}" type="photo" -->`,
          `<td style="padding:${photoPad};vertical-align:top;width:80px;">`,
          blockInnerHtml(photo, palette),
          `</td>`,
          `<!-- /ozer-block -->`,
        ].join('\n')
      : '';

    body = [
      `<tr>`,
      photoCell,
      `<td style="padding:${contentPad};vertical-align:top;color:${palette.primary};">`,
      renderBlockTable(rest, palette),
      `</td>`,
      `</tr>`,
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    body = [
      `<tr><td style="padding:${stackedPad};vertical-align:top;color:${palette.primary};">`,
      renderBlockTable(doc.blocks, palette),
      `</td></tr>`,
    ].join('\n');
  }

  return [header, note, tableOpen, body, `</table>`, footer].join('\n');
}

const BUILDER_OPEN =
  /<!--\s*ozer-sig-builder:v(\d+)\s+layout="(stacked|photo_left)"(?:\s+bg="([^"]*)")?\s*-->/i;
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
  const background = parseBackgroundAttr(open[3]);
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
    background,
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
