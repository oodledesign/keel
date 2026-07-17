export type SignatureAssetKind = 'custom_text' | 'award_badge';
export type SignatureAssetScope = 'workspace' | 'department' | 'branch';

export type SignatureAsset = {
  id: string;
  account_id: string;
  kind: SignatureAssetKind;
  scope: SignatureAssetScope;
  department: string | null;
  branch_id: string | null;
  label: string;
  body: string | null;
  image_url: string | null;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SignatureAssetStaffContext = {
  department?: string | null;
  branch_id?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function filterSignatureAssetsForStaff(
  assets: SignatureAsset[],
  staff: SignatureAssetStaffContext,
): SignatureAsset[] {
  const department = staff.department?.trim().toLowerCase() ?? '';
  const branchId = staff.branch_id ?? null;

  return assets
    .filter((asset) => {
      if (asset.scope === 'workspace') {
        return true;
      }
      if (asset.scope === 'department') {
        return (
          Boolean(department) &&
          (asset.department?.trim().toLowerCase() ?? '') === department
        );
      }
      if (asset.scope === 'branch') {
        return Boolean(branchId) && asset.branch_id === branchId;
      }
      return false;
    })
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.label.localeCompare(b.label);
    });
}

export function renderSignatureCustomTextHtml(
  assets: SignatureAsset[],
): string {
  return assets
    .filter((asset) => asset.kind === 'custom_text' && asset.body?.trim())
    .map(
      (asset) =>
        `<div style="font-size:13px;line-height:1.5;color:#333333;">${escapeHtml(asset.body!.trim()).replace(/\n/g, '<br />')}</div>`,
    )
    .join('');
}

export function renderSignatureAwardBadgesHtml(
  assets: SignatureAsset[],
): string {
  return assets
    .filter((asset) => asset.kind === 'award_badge' && asset.image_url?.trim())
    .map((asset) => {
      const src = escapeHtml(asset.image_url!.trim());
      const alt = escapeHtml(asset.label?.trim() || 'Award badge');
      return `<img src="${src}" alt="${alt}" width="96" style="display:inline-block;max-width:96px;height:auto;border:0;margin:0 8px 0 0;vertical-align:middle;" />`;
    })
    .join('');
}

export function firstAwardBadgeUrl(assets: SignatureAsset[]): string | null {
  const match = assets.find(
    (asset) => asset.kind === 'award_badge' && asset.image_url?.trim(),
  );
  return match?.image_url?.trim() || null;
}
