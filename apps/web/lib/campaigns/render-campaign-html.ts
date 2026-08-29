import {
  type AccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { buildWorkspaceMailingListUnsubscribeUrl } from '~/lib/workspace-forms/workspace-mailing-list';

import {
  applyCampaignMergeFields,
  type CampaignMergeValues,
} from './merge-fields';

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
  const inner = `
    ${merged}
    <p style="margin-top:28px;font-size:12px;line-height:1.5;color:#6b5c63;">
      You are receiving this because you subscribed to updates from this workspace.
      <a href="${unsubscribeUrl}" style="color:#41606F;">Unsubscribe</a>
    </p>
  `;

  return wrapEmailHtmlWithBrand({
    brand: input.brand,
    innerHtml: inner,
  });
}
