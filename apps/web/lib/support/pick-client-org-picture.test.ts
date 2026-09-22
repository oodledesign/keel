import { describe, expect, it } from 'vitest';

import { pickClientOrgPictures } from './pick-client-org-picture';

describe('pickClientOrgPictures', () => {
  it('prefers the business client logo over an individual photo', () => {
    const map = pickClientOrgPictures([
      {
        clientOrgId: 'org-1',
        pictureUrl: 'https://cdn.example.com/person.png',
        clientType: 'individual',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        clientOrgId: 'org-1',
        pictureUrl: 'https://cdn.example.com/company.png?v=abc',
        clientType: 'business',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(map.get('org-1')).toBe('https://cdn.example.com/company.png?v=abc');
  });

  it('skips empty pictures and keeps the cache-busting query', () => {
    const map = pickClientOrgPictures([
      {
        clientOrgId: 'org-1',
        pictureUrl: '  ',
        clientType: 'business',
      },
      {
        clientOrgId: 'org-1',
        pictureUrl:
          'https://project.supabase.co/storage/v1/object/account_image/a/client-1?v=token',
        clientType: 'business',
      },
    ]);

    expect(map.get('org-1')).toContain(
      '/storage/v1/object/public/account_image/',
    );
    expect(map.get('org-1')).toContain('v=token');
  });
});
