import { describe, expect, it } from 'vitest';

import { alignedReplyTo, emailAddressDomain } from './aligned-reply-to';

describe('emailAddressDomain', () => {
  it('reads a bare address', () => {
    expect(emailAddressDomain('dan@oodle.design')).toBe('oodle.design');
  });

  it('reads a named From header', () => {
    expect(emailAddressDomain('Oodle Design via Ozer <hi@ozer.so>')).toBe(
      'ozer.so',
    );
  });
});

describe('alignedReplyTo', () => {
  it('keeps Reply-To when the domain matches From', () => {
    expect(alignedReplyTo('support@ozer.so', 'Ozer <hi@ozer.so>')).toBe(
      'support@ozer.so',
    );
  });

  it('drops Reply-To when the domain does not match From', () => {
    expect(
      alignedReplyTo('dan@oodle.design', 'Oodle Design via Ozer <hi@ozer.so>'),
    ).toBeUndefined();
  });
});
