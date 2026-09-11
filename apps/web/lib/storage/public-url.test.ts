import { describe, expect, it } from 'vitest';

import {
  supabaseStorageObjectPath,
  toSupabasePublicStorageUrl,
} from './public-url';

const SIGNED =
  'https://abc.supabase.co/storage/v1/object/sign/commercial-listing-media/acc/listing/photo.jpg?token=abc';

describe('toSupabasePublicStorageUrl', () => {
  it('leaves signed listing-media URLs intact', () => {
    expect(toSupabasePublicStorageUrl(SIGNED)).toBe(SIGNED);
  });

  it('leaves authenticated object URLs intact', () => {
    const authenticated =
      'https://abc.supabase.co/storage/v1/object/authenticated/brand-assets/logo.png';
    expect(toSupabasePublicStorageUrl(authenticated)).toBe(authenticated);
  });

  it('rewrites a missing /public/ prefix on public buckets', () => {
    expect(
      toSupabasePublicStorageUrl(
        'https://abc.supabase.co/storage/v1/object/brand-assets/acc/logo.png',
      ),
    ).toBe(
      'https://abc.supabase.co/storage/v1/object/public/brand-assets/acc/logo.png',
    );
  });

  it('does not double-prefix already-public URLs', () => {
    const publicUrl =
      'https://abc.supabase.co/storage/v1/object/public/brand-assets/acc/logo.png';
    expect(toSupabasePublicStorageUrl(publicUrl)).toBe(publicUrl);
  });
});

describe('supabaseStorageObjectPath', () => {
  it('reads the key from a signed listing-media URL', () => {
    expect(supabaseStorageObjectPath(SIGNED, 'commercial-listing-media')).toBe(
      'acc/listing/photo.jpg',
    );
  });

  it('reads the key from a public brand-assets URL', () => {
    expect(
      supabaseStorageObjectPath(
        'https://abc.supabase.co/storage/v1/object/public/brand-assets/acc/logo.png',
        'brand-assets',
      ),
    ).toBe('acc/logo.png');
  });

  it('returns null for a different bucket', () => {
    expect(supabaseStorageObjectPath(SIGNED, 'brand-assets')).toBeNull();
  });
});
