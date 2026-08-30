import {
  type AccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { buildWorkspaceMailingListUnsubscribeUrl } from '~/lib/workspace-forms/workspace-mailing-list';

import { isCampaignDocumentHtml } from './campaign-document';
import {
  type CampaignMergeValues,
  applyCampaignMergeFields,
} from './merge-fields';

function applyUnsubscribeUrl(html: string, unsubscribeUrl: string): string {
  if (html.includes('{{unsubscribe_url}}')) {
    return html.replaceAll('{{unsubscribe_url}}', escapeHtml(unsubscribeUrl));
  }

  return `${html}
    <p style="margin-top:28px;font-size:12px;line-height:1.5;color:#6b5c63;">
      You are receiving this because you subscribed to updates from this workspace.
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:#41606F;">Unsubscribe</a>
    </p>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderCampaignHtml(input: {
  brand: AccountBrandResolved;
  htmlBody: string;
  merge: CampaignMergeValues;
  unsubscribeToken: string;
}): string {
  const merged = applyCampaignMergeFields(input.htmlBody, input.merge);
  const unsubscribeUrl = buildWorkspaceMailingListUnsubscribeUrl(
    input.unsubscribeToken,
  );
  const withUnsubscribe = applyUnsubscribeUrl(merged, unsubscribeUrl);

  if (isCampaignDocumentHtml(input.htmlBody)) {
    return withUnsubscribe;
  }

  return wrapEmailHtmlWithBrand({
    brand: input.brand,
    innerHtml: withUnsubscribe,
  });
}
