import 'server-only';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { resolveBranchForStaff } from '~/lib/brand/account-branches';

import { loadDepartmentBadgeUrl } from './graph';
import type { SignaturesStaffRow } from './render-template';
import type { RenderTemplateOptions } from './render-template';

export async function loadSignatureRenderOptions(
  accountId: string,
  staff: SignaturesStaffRow,
): Promise<RenderTemplateOptions> {
  const [awardBadgeUrl, brand, branch] = await Promise.all([
    loadDepartmentBadgeUrl(accountId, staff.department),
    loadAccountBrandResolved(accountId),
    resolveBranchForStaff({
      accountId,
      branchId: staff.branch_id ?? null,
    }),
  ]);

  return { awardBadgeUrl, brand, branch };
}
