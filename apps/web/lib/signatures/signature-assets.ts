import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  filterSignatureAssetsForStaff,
  firstAwardBadgeUrl,
  renderSignatureAwardBadgesHtml,
  renderSignatureCustomTextHtml,
  type SignatureAsset,
  type SignatureAssetStaffContext,
} from './signature-assets-resolve';

export type {
  SignatureAsset,
  SignatureAssetKind,
  SignatureAssetScope,
  SignatureAssetStaffContext,
} from './signature-assets-resolve';

export {
  filterSignatureAssetsForStaff,
  firstAwardBadgeUrl,
  renderSignatureAwardBadgesHtml,
  renderSignatureCustomTextHtml,
} from './signature-assets-resolve';

function signaturesDb() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'signatures');
}

export async function loadSignatureAssets(
  accountId: string,
): Promise<SignatureAsset[]> {
  const db = signaturesDb();
  const { data, error } = await db
    .from('signature_assets')
    .select(
      'id, account_id, kind, scope, department, branch_id, label, body, image_url, sort_order, created_at, updated_at',
    )
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SignatureAsset[];
}

export async function loadResolvedSignatureAssets(
  accountId: string,
  staff: SignatureAssetStaffContext,
): Promise<{
  assets: SignatureAsset[];
  customTextHtml: string;
  awardBadgesHtml: string;
  awardBadgeUrl: string | null;
}> {
  const all = await loadSignatureAssets(accountId);
  const assets = filterSignatureAssetsForStaff(all, staff);
  return {
    assets,
    customTextHtml: renderSignatureCustomTextHtml(assets),
    awardBadgesHtml: renderSignatureAwardBadgesHtml(assets),
    awardBadgeUrl: firstAwardBadgeUrl(assets),
  };
}
