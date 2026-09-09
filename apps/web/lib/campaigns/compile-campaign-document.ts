import {
  type BrandLogoChoice,
  resolveBrandLogoChoice,
} from '~/lib/brand/resolve-brand-logo';

import {
  isCampaignHexColor,
  paddingCss,
  resolveCampaignBlockBackground,
  resolveCampaignBlockPadding,
  resolveCampaignImageLayout,
} from './campaign-block-style';
import {
  CAMPAIGN_DOCUMENT_MARKER,
  type CampaignAlign,
  type CampaignBlock,
  type CampaignBrand,
  type CampaignColumnContent,
  type CampaignDocument,
  isSafeHttpUrl,
} from './campaign-document';
import { isCampaignFormUrlToken } from './form-link';

const DEFAULT_PRIMARY = '#0D2344';
const DEFAULT_SECONDARY = '#FFFFFF';
const DEFAULT_ACCENT = '#57C87F';
const CONTENT_COLOR = '#09111F';
const MUTED_COLOR = '#6b5c63';
const INFO_COLOR = '#41606F';
const PAGE_BG = '#f4f1ec';
const DIVIDER_COLOR = '#e4ddd6';

const ALLOWED_RICH_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
]);

export type CompileCampaignOptions = {
  unsubscribeUrl?: string;
};

export function compileCampaignDocument(
  document: CampaignDocument,
  brand: CampaignBrand,
  options: CompileCampaignOptions = {},
): string {
  const colors = resolveCompileColors(brand);
  const unsubscribeUrl = options.unsubscribeUrl ?? '{{unsubscribe_url}}';
  const rows = document.blocks
    .map((block) => renderBlock(block, brand, colors, unsubscribeUrl))
    .filter(Boolean);

  if (!document.blocks.some((block) => block.type === 'footer')) {
    rows.push(
      renderFooterRow(
        'You are receiving this because you subscribed to updates from this workspace.',
        unsubscribeUrl,
      ),
    );
  }

  return `
${CAMPAIGN_DOCUMENT_MARKER}
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title></title>
<style type="text/css">
  @media only screen and (max-width: 620px) {
    .ozer-email-col { display: block !important; width: 100% !important; max-width: 100% !important; }
    .ozer-email-col + .ozer-email-col { padding-top: 16px !important; }
  }
</style>
<!--[if mso]>
<noscript>
  <xml>
    <o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
</noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:24px 12px;background:${PAGE_BG};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;width:600px;max-width:600px;background:${colors.secondary};">
        ${rows.join('\n')}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`.trim();
}

function resolveCompileColors(brand: CampaignBrand) {
  return {
    primary: safeColor(brand.primary_color, DEFAULT_PRIMARY),
    secondary: safeColor(brand.secondary_color, DEFAULT_SECONDARY),
    accent: safeColor(brand.accent_color, DEFAULT_ACCENT),
  };
}

function renderBlock(
  block: CampaignBlock,
  brand: CampaignBrand,
  colors: ReturnType<typeof resolveCompileColors>,
  unsubscribeUrl: string,
): string {
  switch (block.type) {
    case 'logo':
      return renderLogoRow(block, brand);
    case 'heading':
      return renderHeadingRow(block, brand);
    case 'text':
      return renderTextRow(block, brand);
    case 'image':
      return renderImageRow(block, brand);
    case 'button':
      return renderButtonRow(block, colors.accent, brand);
    case 'divider':
      return renderDividerRow(block, brand);
    case 'spacer':
      return renderSpacerRow(block, brand);
    case 'columns':
      return renderColumnsRow(block, brand);
    case 'footer':
      return renderFooterRow(block, unsubscribeUrl, brand);
    case 'html':
      return renderHtmlRow(block, brand);
  }
}

function renderLogoRow(
  block: Extract<CampaignBlock, { type: 'logo' }>,
  brand: CampaignBrand,
): string {
  const variant = (block.logoVariant ?? 'primary') as BrandLogoChoice;
  const src = resolveBrandLogoChoice(brand, variant);
  const logo = src
    ? `<img src="${escapeAttr(src)}" alt="" height="40" style="display:block;max-height:40px;width:auto;border:0;" />`
    : '';

  return styledRow(logo, {
    align: block.align ?? 'left',
    background: resolveCampaignBlockBackground(block, brand),
    padding: resolveCampaignBlockPadding(block),
  });
}

function renderHeadingRow(
  block: Extract<CampaignBlock, { type: 'heading' }>,
  brand: CampaignBrand,
) {
  const size = block.level === 1 ? 28 : 22;
  const weight = block.level === 1 ? 700 : 600;
  const align = block.align ?? 'left';
  const text = escapeTextKeepMerge(block.text.trim() || 'Heading');

  return styledRow(
    `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:${size}px;line-height:1.3;font-weight:${weight};color:${CONTENT_COLOR};text-align:${align};">${text}</p>`,
    {
      align,
      background: resolveCampaignBlockBackground(block, brand),
      padding: resolveCampaignBlockPadding(block),
    },
  );
}

function renderTextRow(
  block: Extract<CampaignBlock, { type: 'text' }>,
  brand: CampaignBrand,
) {
  const align = block.align ?? 'left';
  const html = sanitizeRichText(block.html) || '<p></p>';

  return styledRow(
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${CONTENT_COLOR};text-align:${align};">${html}</div>`,
    {
      align,
      background: resolveCampaignBlockBackground(block, brand),
      padding: resolveCampaignBlockPadding(block),
    },
  );
}

function renderImageRow(
  block: Extract<CampaignBlock, { type: 'image' }>,
  brand: CampaignBrand,
) {
  if (!block.src.trim() || !isSafeHttpUrl(block.src)) {
    return '';
  }

  const layout = resolveCampaignImageLayout(block);
  const heightAttr = layout.height ? ` height="${layout.height}"` : '';
  const heightStyle = layout.height
    ? `height:${layout.height}px;`
    : 'height:auto;';
  const widthStyle = layout.fullWidth
    ? `width:100%;max-width:${layout.width}px;`
    : `width:${layout.width}px;max-width:100%;`;
  const image = `<img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}" width="${layout.width}"${heightAttr} style="display:block;${widthStyle}${heightStyle}border:0;" />`;
  const inner =
    block.href && isSafeHttpUrl(block.href)
      ? `<a href="${escapeAttr(block.href)}" style="text-decoration:none;">${image}</a>`
      : image;

  return styledRow(inner, {
    align: block.align ?? 'left',
    background: resolveCampaignBlockBackground(block, brand),
    padding: resolveCampaignBlockPadding(block),
  });
}

function renderButtonRow(
  block: Extract<CampaignBlock, { type: 'button' }>,
  accent: string,
  brand: CampaignBrand,
) {
  const rawHref = block.href.trim();
  const href =
    rawHref && (isSafeHttpUrl(rawHref) || isCampaignFormUrlToken(rawHref))
      ? rawHref
      : '#';
  const label = escapeTextKeepMerge(block.label.trim() || 'Read more');
  const align = block.align ?? 'center';

  return styledRow(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td align="center" bgcolor="${accent}" style="background:${accent};border-radius:6px;">
          <a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
        </td>
      </tr>
    </table>`,
    {
      align,
      background: resolveCampaignBlockBackground(block, brand),
      padding: resolveCampaignBlockPadding(block),
    },
  );
}

function renderDividerRow(
  block: Extract<CampaignBlock, { type: 'divider' }>,
  brand: CampaignBrand,
) {
  return styledRow(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-top:1px solid ${DIVIDER_COLOR};font-size:0;line-height:0;">&nbsp;</td></tr></table>`,
    {
      background: resolveCampaignBlockBackground(block, brand),
      padding: resolveCampaignBlockPadding(block),
    },
  );
}

function renderSpacerRow(
  block: Extract<CampaignBlock, { type: 'spacer' }>,
  brand: CampaignBrand,
) {
  const px = Math.min(120, Math.max(8, block.height));
  return styledRow(`&nbsp;`, {
    background: resolveCampaignBlockBackground(block, brand),
    padding: resolveCampaignBlockPadding(block),
    extraTdStyle: `height:${px}px;line-height:${px}px;font-size:0;`,
  });
}

function renderColumnsRow(
  block: Extract<CampaignBlock, { type: 'columns' }>,
  brand: CampaignBrand,
) {
  return styledRow(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr>
        <td class="ozer-email-col" width="50%" valign="top" style="width:50%;padding:0 12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${CONTENT_COLOR};">
          ${renderColumnContent(block.left)}
        </td>
        <td class="ozer-email-col" width="50%" valign="top" style="width:50%;padding:0 0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${CONTENT_COLOR};">
          ${renderColumnContent(block.right)}
        </td>
      </tr>
    </table>`,
    {
      background: resolveCampaignBlockBackground(block, brand),
      padding: resolveCampaignBlockPadding(block),
    },
  );
}

function renderColumnContent(column: CampaignColumnContent): string {
  if (column.kind === 'image') {
    if (!column.src.trim() || !isSafeHttpUrl(column.src)) {
      return '&nbsp;';
    }

    const image = `<img src="${escapeAttr(column.src)}" alt="${escapeAttr(column.alt)}" width="250" style="display:block;width:100%;max-width:250px;height:auto;border:0;" />`;
    if (column.href && isSafeHttpUrl(column.href)) {
      return `<a href="${escapeAttr(column.href)}" style="text-decoration:none;">${image}</a>`;
    }
    return image;
  }

  return sanitizeRichText(column.html) || '&nbsp;';
}

function renderFooterRow(
  block: Extract<CampaignBlock, { type: 'footer' }> | string,
  unsubscribeUrl: string,
  brand?: CampaignBrand,
): string {
  const text = typeof block === 'string' ? block : block.text;
  const safeText = escapeTextKeepMerge(
    text.trim() ||
      'You are receiving this because you subscribed to updates from this workspace.',
  );
  const href =
    unsubscribeUrl === '{{unsubscribe_url}}'
      ? '{{unsubscribe_url}}'
      : escapeAttr(unsubscribeUrl);

  const padding =
    typeof block === 'string'
      ? resolveCampaignBlockPadding({
          id: 'footer',
          type: 'footer',
          text,
        })
      : resolveCampaignBlockPadding(block);
  const background =
    typeof block === 'string'
      ? null
      : resolveCampaignBlockBackground(block, brand);

  return styledRow(
    `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED_COLOR};">${safeText}<br /><a href="${href}" style="color:${INFO_COLOR};text-decoration:underline;">Unsubscribe</a></p>`,
    { background, padding },
  );
}

function renderHtmlRow(
  block: Extract<CampaignBlock, { type: 'html' }>,
  brand: CampaignBrand,
): string {
  const cleaned = stripDangerousHtml(block.html).trim();
  if (!cleaned) return '';
  return styledRow(
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${CONTENT_COLOR};">${cleaned}</div>`,
    {
      background: resolveCampaignBlockBackground(block, brand),
      padding: resolveCampaignBlockPadding(block),
    },
  );
}

function styledRow(
  inner: string,
  options: {
    align?: CampaignAlign;
    background?: string | null;
    padding: ReturnType<typeof resolveCampaignBlockPadding>;
    extraTdStyle?: string;
  },
): string {
  const align = options.align ?? 'left';
  const background = options.background
    ? `background:${options.background};`
    : '';
  const extra = options.extraTdStyle ?? '';

  return row(
    `<td align="${align}" style="${background}padding:${paddingCss(options.padding)};font-family:Arial,Helvetica,sans-serif;color:${CONTENT_COLOR};${extra}">${inner}</td>`,
  );
}

function row(inner: string): string {
  return `<tr>${inner}</tr>`;
}

function safeColor(value: string | null | undefined, fallback: string): string {
  return isCampaignHexColor(value) ? value : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function escapeTextKeepMerge(value: string): string {
  return escapeHtml(value);
}

function extractHref(attrs: string): string | null {
  const match = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const raw = match?.[2] ?? match?.[3] ?? match?.[4];
  if (!raw) return null;
  const href = raw.trim();
  if (href.startsWith('{{') && href.endsWith('}}')) return href;
  if (href.startsWith('#') || href.startsWith('mailto:')) return href;
  return isSafeHttpUrl(href) ? href : null;
}

export function sanitizeRichText(html: string): string {
  const withoutDanger = stripDangerousHtml(html);

  return withoutDanger.replace(
    /<\/?([a-zA-Z0-9]+)([^>]*)>/g,
    (match, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      const closing = match.startsWith('</');

      if (!ALLOWED_RICH_TAGS.has(tag)) {
        return '';
      }

      if (tag === 'br') {
        return '<br />';
      }

      if (closing) {
        return `</${tag}>`;
      }

      if (tag === 'a') {
        const href = extractHref(attrs);
        if (!href) return '';
        return `<a href="${escapeAttr(href)}" style="color:${INFO_COLOR};text-decoration:underline;">`;
      }

      if (tag === 'p') {
        return `<p style="margin:0 0 12px;">`;
      }

      if (tag === 'ul' || tag === 'ol') {
        const listStyle = tag === 'ul' ? 'disc' : 'decimal';
        return `<${tag} style="margin:0 0 12px;padding-left:20px;list-style-type:${listStyle};">`;
      }

      if (tag === 'li') {
        return `<li style="margin:0 0 4px;">`;
      }

      return `<${tag}>`;
    },
  );
}

function stripDangerousHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}
