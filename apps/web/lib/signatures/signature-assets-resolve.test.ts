import { describe, expect, it } from 'vitest';

import {
  type SignatureAsset,
  filterSignatureAssetsForStaff,
  firstAwardBadgeUrl,
  renderSignatureAwardBadgesHtml,
  renderSignatureCustomTextHtml,
} from './signature-assets-resolve';

function asset(
  partial: Partial<SignatureAsset> &
    Pick<SignatureAsset, 'id' | 'kind' | 'scope'>,
): SignatureAsset {
  return {
    account_id: 'acc',
    department: null,
    branch_id: null,
    label: partial.label ?? 'Item',
    body: null,
    image_url: null,
    sort_order: 0,
    ...partial,
  };
}

describe('filterSignatureAssetsForStaff', () => {
  const assets: SignatureAsset[] = [
    asset({
      id: '1',
      kind: 'custom_text',
      scope: 'workspace',
      label: 'Legal',
      body: 'All staff notice',
      sort_order: 2,
    }),
    asset({
      id: '2',
      kind: 'custom_text',
      scope: 'department',
      department: 'Residential',
      label: 'Resi',
      body: 'Residential only',
      sort_order: 1,
    }),
    asset({
      id: '3',
      kind: 'award_badge',
      scope: 'department',
      department: 'Commercial',
      label: 'CoStar',
      image_url: 'https://cdn.example.com/costar.png',
    }),
    asset({
      id: '4',
      kind: 'award_badge',
      scope: 'branch',
      branch_id: 'branch-a',
      label: 'Local',
      image_url: 'https://cdn.example.com/local.png',
    }),
  ];

  it('includes workspace + matching department assets', () => {
    const matched = filterSignatureAssetsForStaff(assets, {
      department: 'Residential',
      branch_id: null,
    });
    expect(matched.map((item) => item.id)).toEqual(['2', '1']);
  });

  it('includes workspace + matching branch assets', () => {
    const matched = filterSignatureAssetsForStaff(assets, {
      department: null,
      branch_id: 'branch-a',
    });
    expect(matched.map((item) => item.id)).toEqual(['4', '1']);
  });

  it('renders custom text and badges for the resolved set', () => {
    const matched = filterSignatureAssetsForStaff(assets, {
      department: 'Residential',
      branch_id: 'branch-a',
    });
    const text = renderSignatureCustomTextHtml(matched);
    expect(text).toContain('Residential only');
    expect(text).toContain('All staff notice');
    expect(firstAwardBadgeUrl(matched)).toBe(
      'https://cdn.example.com/local.png',
    );
    expect(renderSignatureAwardBadgesHtml(matched)).toContain(
      'https://cdn.example.com/local.png',
    );
  });
});
