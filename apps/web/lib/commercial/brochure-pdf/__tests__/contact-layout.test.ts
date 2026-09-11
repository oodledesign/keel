import { describe, expect, it } from 'vitest';

import { brochureContactShopfrontBox } from '../contact-layout';

describe('brochureContactShopfrontBox', () => {
  it('keeps the shopfront in the branch column below the address', () => {
    const afterAddressY = 380;
    const margin = 40;
    const branchCardWidth = 300;

    const landscape = brochureContactShopfrontBox({
      landscape: true,
      pageWidth: 841.89,
      margin,
      branchCardWidth,
      afterAddressY,
    });

    expect(landscape.x).toBe(margin);
    expect(landscape.x + landscape.width).toBeLessThanOrEqual(
      margin + branchCardWidth,
    );
    expect(landscape.y + landscape.height).toBeLessThan(afterAddressY);
    expect(landscape.x + landscape.width).toBeLessThan(841.89 / 2);

    const portrait = brochureContactShopfrontBox({
      landscape: false,
      pageWidth: 595.28,
      margin,
      branchCardWidth: 515.28,
      afterAddressY,
    });
    expect(portrait.x).toBe(margin);
    expect(portrait.y + portrait.height).toBeLessThan(afterAddressY);
  });
});
