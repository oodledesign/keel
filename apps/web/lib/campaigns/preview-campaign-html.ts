import type { CampaignBrand, CampaignDocument } from './campaign-document';
import { isCampaignDocumentHtml } from './campaign-document';
import { compileCampaignDocument } from './compile-campaign-document';
import {
  type CampaignMergeValues,
  applyCampaignMergeFields,
} from './merge-fields';

const PREVIEW_UNSUBSCRIBE = '#unsubscribe';

const PREVIEW_NAV_STYLE =
  '<style data-ozer-preview-nav>a,area{pointer-events:none!important;cursor:default!important}form{pointer-events:none!important}</style>';

/**
 * Stop preview iframes from navigating when links/buttons are clicked.
 * Real send HTML must not use this — only the client preview path.
 */
export function neutralizePreviewNavigation(html: string): string {
  let out = html.replace(/<a\b([^>]*)>/gi, (_match, attrs: string) => {
    let next = String(attrs)
      .replace(/\s+href\s*=\s*(["'])[\s\S]*?\1/gi, ' href="#"')
      .replace(/\s+href\s*=\s*[^\s>]+/gi, ' href="#"')
      .replace(/\s+target\s*=\s*(["'])[\s\S]*?\1/gi, '')
      .replace(/\s+target\s*=\s*[^\s>]+/gi, '');
    if (!/\bhref\s*=/i.test(next)) {
      next += ' href="#"';
    }
    return `<a${next}>`;
  });

  out = out.replace(/<area\b([^>]*)>/gi, (_match, attrs: string) => {
    let next = String(attrs)
      .replace(/\s+href\s*=\s*(["'])[\s\S]*?\1/gi, ' href="#"')
      .replace(/\s+href\s*=\s*[^\s>]+/gi, ' href="#"')
      .replace(/\s+target\s*=\s*(["'])[\s\S]*?\1/gi, '')
      .replace(/\s+target\s*=\s*[^\s>]+/gi, '');
    if (!/\bhref\s*=/i.test(next)) {
      next += ' href="#"';
    }
    return `<area${next}>`;
  });

  out = out.replace(/<form\b([^>]*)>/gi, (_match, attrs: string) => {
    let next = String(attrs)
      .replace(/\s+action\s*=\s*(["'])[\s\S]*?\1/gi, ' action="#"')
      .replace(/\s+action\s*=\s*[^\s>]+/gi, ' action="#"');
    if (!/\baction\s*=/i.test(next)) {
      next += ' action="#"';
    }
    return `<form${next}>`;
  });

  if (out.includes('data-ozer-preview-nav')) {
    return out;
  }

  if (/<head\b[^>]*>/i.test(out)) {
    return out.replace(/<head\b[^>]*>/i, (open) => `${open}${PREVIEW_NAV_STYLE}`);
  }

  return `${PREVIEW_NAV_STYLE}${out}`;
}

/** Client-safe preview. Send path uses the server renderer + real unsubscribe tokens. */
export function previewCampaignHtml(input: {
  brand: CampaignBrand & { contact_email?: string | null };
  htmlBody?: string;
  document?: CampaignDocument | null;
  merge: CampaignMergeValues;
}): string {
  const compiled = input.document
    ? compileCampaignDocument(input.document, input.brand, {
        unsubscribeUrl: PREVIEW_UNSUBSCRIBE,
      })
    : (input.htmlBody ?? '');

  const merged = applyCampaignMergeFields(compiled, input.merge).replaceAll(
    '{{unsubscribe_url}}',
    PREVIEW_UNSUBSCRIBE,
  );

  let html: string;
  if (isCampaignDocumentHtml(compiled) || input.document) {
    html = merged;
  } else {
    const primary = input.brand.primary_color || '#0D2344';
    const logo = input.brand.logo_url
      ? `<img src="${input.brand.logo_url}" alt="" height="40" style="display:block;max-height:40px;width:auto;border:0;" />`
      : '';

    html = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <tr>
    <td style="background:${primary};padding:16px 20px;">${logo}</td>
  </tr>
  <tr>
    <td style="padding:20px;font-family:Arial,sans-serif;color:#09111F;line-height:1.6;">
      ${merged}
      <p style="margin-top:28px;font-size:12px;line-height:1.5;color:#6b5c63;">
        Unsubscribe link is added per recipient when you send.
      </p>
    </td>
  </tr>
</table>`.trim();
  }

  return neutralizePreviewNavigation(html);
}
