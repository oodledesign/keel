import { describe, expect, it } from 'vitest';

import {
  isEmailNotificationEnabled,
  resolveEmailNotificationPreferences,
} from './email-notification-preferences';

describe('email notification preferences', () => {
  it('defaults match digest emails to on', () => {
    expect(
      isEmailNotificationEnabled(undefined, 'commercial_match_digest'),
    ).toBe(true);
    expect(isEmailNotificationEnabled({}, 'commercial_match_digest')).toBe(
      true,
    );
  });

  it('honours an explicit off toggle', () => {
    expect(
      isEmailNotificationEnabled(
        { commercial_match_digest: false },
        'commercial_match_digest',
      ),
    ).toBe(false);
  });

  it('resolves a full map', () => {
    expect(
      resolveEmailNotificationPreferences({ commercial_match_digest: false }),
    ).toEqual({
      commercial_match_digest: false,
      email_stuck_thread_digest: true,
      email_follow_up_reminders: true,
    });
  });
});
