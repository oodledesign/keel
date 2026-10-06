import { describe, expect, it } from 'vitest';

import { collectRightmoveUrls } from '../rightmove-publish-status';

describe('collectRightmoveUrls', () => {
  it('includes the for sale property of a dual disposal', () => {
    expect(
      collectRightmoveUrls({
        externalUrl:
          'https://www.rightmove.co.uk/commercial-property-to-rent/property-1.html',
        metadata: {
          rightmoveSale: {
            reference: 'abc-sale',
            status: 'published',
            externalUrl:
              'https://www.rightmove.co.uk/commercial-property-for-sale/property-2.html',
          },
        },
      }),
    ).toHaveLength(2);
  });
});
