import 'server-only';

import { resolveBranchForStaff } from '~/lib/brand/account-branches';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import type { SignaturesStaffRow } from './render-template';
import type { RenderTemplateOptions } from './render-template';
import { loadResolvedSignatureAssets } from './signature-assets';

export async function loadSignatureRenderOptions(
  accountId: string,
  staff: SignaturesStaffRow,
): Promise<RenderTemplateOptions> {
  const [resolvedAssets, brand, branch] = await Promise.all([
    loadResolvedSignatureAssets(accountId, {
      department: staff.department,
      branch_id: staff.branch_id ?? null,
    }),
    loadAccountBrandResolved(accountId),
    resolveBranchForStaff({
      accountId,
      branchId: staff.branch_id ?? null,
    }),
  ]);

  return {
    awardBadgeUrl: resolvedAssets.awardBadgeUrl,
    awardBadgesHtml: resolvedAssets.awardBadgesHtml,
    signatureCustomTextHtml: resolvedAssets.customTextHtml,
    brand,
    branch,
  };
}
