import { describe, expect, it } from 'vitest';

import {
  applyCampaignMergeFields,
  firstNameFromDisplay,
  mergeValuesForRecipient,
} from './merge-fields';

describe('campaign merge fields', () => {
  it('takes the first word as first name', () => {
    expect(firstNameFromDisplay('Ada Lovelace', 'ada@example.com')).toBe('Ada');
    expect(firstNameFromDisplay(null, 'ada@example.com')).toBe('ada');
  });

  it('substitutes tokens and escapes HTML', () => {
    const values = mergeValuesForRecipient({
      displayName: 'Ada <script>',
      email: 'ada@example.com',
    });
    const html = applyCampaignMergeFields(
      '<p>Hi {{name}} ({{email}})</p>',
      values,
    );
    expect(html).toContain('Ada &lt;script&gt;');
    expect(html).toContain('ada@example.com');
    expect(html).not.toContain('<script>');
  });
});
