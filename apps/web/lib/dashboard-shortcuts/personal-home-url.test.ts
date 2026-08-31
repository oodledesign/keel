import { describe, expect, it } from 'vitest';

import { appendMissingSearchParams } from './personal-home-url';

describe('appendMissingSearchParams', () => {
  it('copies missing query keys onto the landing URL', () => {
    const target = new URL('https://app.ozer.so/app/oodle-design');
    const search = new URLSearchParams(
      'feedflow_error=Feedflow+is+disabled&other=1',
    );

    appendMissingSearchParams(target, search);

    expect(target.searchParams.get('feedflow_error')).toBe(
      'Feedflow is disabled',
    );
    expect(target.searchParams.get('other')).toBe('1');
  });

  it('does not overwrite existing keys', () => {
    const target = new URL('https://app.ozer.so/app/oodle-design?other=keep');
    const search = new URLSearchParams('other=drop');

    appendMissingSearchParams(target, search);

    expect(target.searchParams.get('other')).toBe('keep');
  });
});
