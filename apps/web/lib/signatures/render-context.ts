import 'server-only';

import { resolveBranchForStaff } from '~/lib/brand/account-branches';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import { applySignatureProfileOverrides } from './profile-overrides';
import type { SignaturesStaffRow } from './render-template';
import type { RenderTemplateOptions } from './render-template';
import { loadResolvedSignatureAssets } from './signature-assets';
import { htmlToSignatureBlocks, isPhotoBadgeEnabled } from './signature-blocks';
import { loadSignaturesWorkspaceSettings } from './workspace-settings';

export async function loadSignatureRenderOptions(
  accountId: string,
  staff: SignaturesStaffRow,
  htmlTemplate?: string | null,
): Promise<RenderTemplateOptions> {
  const profile = applySignatureProfileOverrides(staff);
  const [resolvedAssets, brand, branch, workspaceSettings] = await Promise.all([
    loadResolvedSignatureAssets(accountId, {
      department: profile.department,
      branch_id: staff.branch_id ?? null,
    }),
    loadAccountBrandResolved(accountId),
    resolveBranchForStaff({
      accountId,
      branchId: staff.branch_id ?? null,
    }),
    loadSignaturesWorkspaceSettings(accountId),
  ]);

  const builderDoc = htmlTemplate ? htmlToSignatureBlocks(htmlTemplate) : null;

  return {
    awardBadgeUrl: resolvedAssets.awardBadgeUrl,
    awardBadgesHtml: resolvedAssets.awardBadgesHtml,
    signatureCustomTextHtml: resolvedAssets.customTextHtml,
    brand,
    branch,
    companyLogoUrl: workspaceSettings.company_logo_url,
    companyIconUrl: workspaceSettings.company_icon_url,
    showPhotoBadge: isPhotoBadgeEnabled(builderDoc?.showPhotoBadge),
  };
}
