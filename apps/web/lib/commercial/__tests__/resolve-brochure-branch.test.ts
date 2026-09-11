import { describe, expect, it } from 'vitest';

import { resolveBrochureBranch } from '~/lib/commercial/public-brochure.shared';

const tunbridge = {
  id: 'branch-tw',
  name: 'Tunbridge Wells',
  address: '27/29 High Street, Tunbridge Wells',
  phone: '01892 526111',
  email: 'tw@example.com',
  shopfrontUrl: 'https://cdn.example.com/tw-shopfront.jpg',
  isDefault: true,
};

const sevenoaks = {
  id: 'branch-so',
  name: 'Sevenoaks',
  address: '1 London Road, Sevenoaks',
  phone: '01732 740000',
  email: 'so@example.com',
  shopfrontUrl: 'https://cdn.example.com/so-shopfront.jpg',
  isDefault: false,
};

describe('resolveBrochureBranch', () => {
  it('uses the listing office shopfront when account_branch_id is set', () => {
    const branch = resolveBrochureBranch({
      branches: [tunbridge, sevenoaks],
      listingBranchId: sevenoaks.id,
      accountName: 'Bracketts',
    });

    expect(branch.name).toBe('Sevenoaks');
    expect(branch.shopfrontUrl).toBe(
      'https://cdn.example.com/so-shopfront.jpg',
    );
    expect(branch.address).toBe('1 London Road, Sevenoaks');
  });

  it('falls back to the default branch shopfront', () => {
    const branch = resolveBrochureBranch({
      branches: [sevenoaks, tunbridge],
      listingBranchId: null,
      accountName: 'Bracketts',
    });

    expect(branch.name).toBe('Tunbridge Wells');
    expect(branch.shopfrontUrl).toBe(
      'https://cdn.example.com/tw-shopfront.jpg',
    );
  });

  it('omits shopfront when the picked branch has none', () => {
    const branch = resolveBrochureBranch({
      branches: [{ ...tunbridge, shopfrontUrl: null }],
      listingBranchId: tunbridge.id,
      accountName: 'Bracketts',
      fallback: { address: 'Brand HQ' },
    });

    expect(branch.shopfrontUrl).toBeNull();
    expect(branch.address).toBe('27/29 High Street, Tunbridge Wells');
  });
});
