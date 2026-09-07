import { describe, expect, it } from 'vitest';

import {
  buildFormEmailVars,
  defaultRsvpEmailSettings,
  interpolateFormEmailText,
  matchFormEmailTemplate,
  parseWorkspaceFormEmailSettings,
} from './form-email';
import { workspaceFormFieldsForTemplate } from './form-templates';

describe('workspace form email settings', () => {
  it('parses empty / invalid as defaults', () => {
    expect(parseWorkspaceFormEmailSettings(null)).toEqual({
      templates: [],
      rules: [],
      notifyMemberIds: [],
      notifyEmails: [],
    });
  });

  it('caps notify emails at 10 and normalizes them', () => {
    const emails = Array.from({ length: 12 }, (_, i) => `Host${i}@Example.com`);
    const parsed = parseWorkspaceFormEmailSettings({
      notifyEmails: emails,
    });
    expect(parsed.notifyEmails).toHaveLength(10);
    expect(parsed.notifyEmails[0]).toBe('host0@example.com');
  });

  it('matches RSVP Yes then No autoresponders', () => {
    const settings = defaultRsvpEmailSettings();
    const yes = matchFormEmailTemplate(
      settings,
      { attendance: 'Yes' },
      'autoresponder',
    );
    const no = matchFormEmailTemplate(
      settings,
      { attendance: 'No' },
      'autoresponder',
    );
    expect(yes?.id).toBe('rsvp_yes');
    expect(no?.id).toBe('rsvp_no');
  });

  it('falls through to an always-on notification rule', () => {
    const settings = defaultRsvpEmailSettings();
    const notify = matchFormEmailTemplate(
      settings,
      { attendance: 'Yes' },
      'notification',
    );
    expect(notify?.id).toBe('rsvp_notify');
  });

  it('interpolates merge fields including event address', () => {
    const fields = workspaceFormFieldsForTemplate('rsvp');
    const vars = buildFormEmailVars({
      formName: 'Summer party',
      accountName: 'Ozer Studio',
      eventAddress: '12 Market Street, Leeds',
      contactName: 'Ada',
      contactEmail: 'ada@example.com',
      fields,
      values: { name: 'Ada', email: 'ada@example.com', attendance: 'Yes' },
    });

    expect(
      interpolateFormEmailText(
        'Hi {{name}} — {{attendance}} at {{event_name}} ({{event_address}})',
        vars,
      ),
    ).toBe('Hi Ada — Yes at Summer party (12 Market Street, Leeds)');
  });
});
