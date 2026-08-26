import { describe, expect, it } from 'vitest';

import { isEmailRoute } from './is-email-route';

describe('isEmailRoute', () => {
  it('matches personal and team email inboxes', () => {
    expect(isEmailRoute('/app/email')).toBe(true);
    expect(isEmailRoute('/app/email/')).toBe(true);
    expect(isEmailRoute('/home/email')).toBe(true);
    expect(isEmailRoute('/app/oodle/email')).toBe(true);
    expect(isEmailRoute('/home/oodle/email')).toBe(true);
  });

  it('does not match email sub-routes', () => {
    expect(isEmailRoute('/app/email/suggested-tasks')).toBe(false);
    expect(isEmailRoute('/app/oodle/tasks')).toBe(false);
  });
});
