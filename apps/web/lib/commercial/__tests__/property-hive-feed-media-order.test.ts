import { describe, expect, it } from 'vitest';

import {
  type PropertyHiveFeedMediaInput,
  collectPropertyHiveFeedMedia,
} from '../property-hive-feed-media';

function media(
  overrides: Partial<PropertyHiveFeedMediaInput> &
    Pick<PropertyHiveFeedMediaInput, 'id'>,
): PropertyHiveFeedMediaInput {
  return {
    media_type: 'image',
    file_name: `${overrides.id}.jpg`,
    mime_type: 'image/jpeg',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const resolveUrl = (item: PropertyHiveFeedMediaInput) =>
  `https://cdn.example/${item.id}`;

describe('collectPropertyHiveFeedMedia', () => {
  it('emits Property Hive images in sort_order (then created_at / id)', () => {
    const { images } = collectPropertyHiveFeedMedia(
      [
        media({
          id: 'hero-later',
          file_name: 'later.jpg',
          sort_order: 2,
          created_at: '2026-01-01T00:00:00Z',
        }),
        media({
          id: 'hero-first',
          file_name: 'first.jpg',
          sort_order: 0,
          created_at: '2026-01-03T00:00:00Z',
        }),
        media({
          id: 'hero-middle',
          file_name: 'middle.jpg',
          sort_order: 1,
          created_at: '2026-01-02T00:00:00Z',
        }),
      ],
      resolveUrl,
    );

    expect(images.map((image) => image.name)).toEqual([
      'first.jpg',
      'middle.jpg',
      'later.jpg',
    ]);
    expect(images.map((image) => image.url)).toEqual([
      'https://cdn.example/hero-first',
      'https://cdn.example/hero-middle',
      'https://cdn.example/hero-later',
    ]);
  });

  it('breaks sort_order ties the same way for Property Hive and EACH', () => {
    const tied = [
      media({
        id: 'z',
        file_name: 'z.jpg',
        sort_order: 0,
        created_at: '2026-01-02T00:00:00Z',
      }),
      media({
        id: 'a',
        file_name: 'a.jpg',
        sort_order: 0,
        created_at: '2026-01-02T00:00:00Z',
      }),
      media({
        id: 'm',
        file_name: 'm.jpg',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      }),
    ];

    const { images } = collectPropertyHiveFeedMedia(tied, resolveUrl);

    expect(images.map((image) => image.name)).toEqual([
      'm.jpg',
      'a.jpg',
      'z.jpg',
    ]);
  });

  it('keeps EACH / Property Hive inclusion rules — only order changes', () => {
    const { images, files } = collectPropertyHiveFeedMedia(
      [
        media({
          id: 'plan',
          media_type: 'floorplan',
          file_name: 'plan.pdf',
          mime_type: 'application/pdf',
          sort_order: 0,
        }),
        media({
          id: 'photo',
          file_name: 'photo.jpg',
          sort_order: 5,
        }),
        media({
          id: 'epc',
          media_type: 'epc',
          file_name: 'epc.pdf',
          mime_type: 'application/pdf',
          sort_order: 1,
        }),
        media({
          id: 'floor-photo',
          media_type: 'floorplan',
          file_name: 'floor.jpg',
          mime_type: 'image/jpeg',
          sort_order: 2,
        }),
      ],
      resolveUrl,
    );

    expect(images.map((image) => image.name)).toEqual([
      'floor.jpg',
      'photo.jpg',
    ]);
    expect(files.map((file) => ({ name: file.name, type: file.type }))).toEqual(
      [
        { name: 'plan.pdf', type: '2' },
        { name: 'epc.pdf', type: '3' },
      ],
    );
  });

  it('skips media without a resolvable URL', () => {
    const { images } = collectPropertyHiveFeedMedia(
      [
        media({ id: 'missing', file_name: 'missing.jpg', sort_order: 0 }),
        media({ id: 'kept', file_name: 'kept.jpg', sort_order: 1 }),
      ],
      (item) => (item.id === 'missing' ? null : resolveUrl(item)),
    );

    expect(images.map((image) => image.name)).toEqual(['kept.jpg']);
  });
});
