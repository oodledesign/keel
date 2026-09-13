import { describe, expect, it } from 'vitest';

import {
  formatShoppingListCsv,
  formatShoppingListPlainText,
} from '~/lib/meals/shopping-export';

const items = [
  {
    display_text: '3 onions',
    category: 'produce',
    checked: false,
    in_pantry: false,
  },
  {
    display_text: 'olive oil',
    category: 'store_cupboard',
    checked: false,
    in_pantry: true,
  },
  {
    display_text: 'secret snack',
    category: 'other',
    excluded: true,
  },
];

describe('formatShoppingListPlainText', () => {
  it('groups items and marks pantry, skipping excluded', () => {
    const text = formatShoppingListPlainText(items);

    expect(text).toContain('Produce');
    expect(text).toContain('[ ] 3 onions');
    expect(text).toContain('[have] olive oil');
    expect(text).not.toContain('secret snack');
  });
});

describe('formatShoppingListCsv', () => {
  it('writes a header and pantry status', () => {
    const csv = formatShoppingListCsv(items);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('category,item,status');
    expect(lines).toEqual(
      expect.arrayContaining([
        'Produce,3 onions,need',
        'Store cupboard,olive oil,in pantry',
      ]),
    );
    expect(csv).not.toContain('secret snack');
  });
});
