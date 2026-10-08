import { describe, expect, it } from 'vitest';

import {
  isEmailNotificationEnabled,
  resolveEmailNotificationPreferences,
  visibleEmailNotificationKeys,
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
      project_retainer_digest: true,
    });
  });

  it('shows match suggestion emails only in commercial property workspaces', () => {
    expect(
      visibleEmailNotificationKeys({
        workspaceProfile: 'commercial_property',
        businessLite: false,
        emailAssistantAvailable: false,
      }),
    ).toEqual(['commercial_match_digest']);

    expect(
      visibleEmailNotificationKeys({
        workspaceProfile: 'work_design',
        businessLite: false,
        emailAssistantAvailable: false,
      }),
    ).toEqual(['project_retainer_digest']);
  });

  it('hides retainer digests on Business Free and gates email assistant emails', () => {
    expect(
      visibleEmailNotificationKeys({
        workspaceProfile: 'work_design',
        businessLite: true,
        emailAssistantAvailable: true,
      }),
    ).toEqual(['email_stuck_thread_digest', 'email_follow_up_reminders']);

    expect(
      visibleEmailNotificationKeys({
        workspaceProfile: 'family',
        businessLite: false,
        emailAssistantAvailable: false,
      }),
    ).toEqual([]);
  });
});
