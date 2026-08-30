import type { CampaignBrand, CampaignDocument } from './campaign-document';
import { isCampaignDocumentHtml } from './campaign-document';
import { compileCampaignDocument } from './compile-campaign-document';
import {
  type CampaignMergeValues,
  applyCampaignMergeFields,
} from './merge-fields';

const PREVIEW_UNSUBSCRIBE = '#unsubscribe';

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

  if (isCampaignDocumentHtml(compiled) || input.document) {
    return merged;
  }

  const primary = input.brand.primary_color || '#0D2344';
  const logo = input.brand.logo_url
    ? `<img src="${input.brand.logo_url}" alt="" height="40" style="display:block;max-height:40px;width:auto;border:0;" />`
    : '';

  return `
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
