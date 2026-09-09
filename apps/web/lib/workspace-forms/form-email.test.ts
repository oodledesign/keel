import { describe, expect, it } from 'vitest';

import {
  buildFormEmailVars,
  composeFormNotificationBody,
  defaultRsvpEmailSettings,
  interpolateFormEmailHtml,
  interpolateFormEmailText,
  listFormEmailMergeTokens,
  listFormSubmittedAnswers,
  matchFormEmailTemplate,
  parseWorkspaceFormEmailSettings,
  renderFormAnswersHtml,
  withFormEmailHtmlVars,
} from './form-email';
import { workspaceFormFieldsForTemplate } from './form-templates';

describe('workspace form email settings', () => {
  it('parses empty / invalid as defaults', () => {
    expect(parseWorkspaceFormEmailSettings(null)).toEqual({
      templates: [],
      rules: [],
      notifyMemberIds: [],
      notifyEmails: [],
      includeSubmittedAnswers: true,
    });
  });

  it('defaults includeSubmittedAnswers on when the key is missing', () => {
    const parsed = parseWorkspaceFormEmailSettings({
      notifyEmails: ['host@example.com'],
    });
    expect(parsed.includeSubmittedAnswers).toBe(true);
  });

  it('honours includeSubmittedAnswers false', () => {
    const parsed = parseWorkspaceFormEmailSettings({
      includeSubmittedAnswers: false,
    });
    expect(parsed.includeSubmittedAnswers).toBe(false);
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
    expect(settings.includeSubmittedAnswers).toBe(true);
  });

  it('interpolates merge fields including event address and aliases', () => {
    const fields = workspaceFormFieldsForTemplate('rsvp');
    const vars = buildFormEmailVars({
      formName: 'Summer party',
      accountName: 'Ozer Studio',
      eventAddress: '12 Market Street, Leeds',
      eventDate: '15 October',
      eventTime: '8:00am - 10:00am',
      contactName: 'Ada',
      contactEmail: 'ada@example.com',
      fields,
      values: { name: 'Ada', email: 'ada@example.com', attendance: 'Yes' },
      submissionUrl: 'https://ozer.so/app/studio/forms/form-1',
    });

    expect(
      interpolateFormEmailText(
        'Hi {{name}} — {{attendance}} at {{event_name}} ({{event_address}}) {{event_date}} {{event_time}}',
        vars,
      ),
    ).toBe(
      'Hi Ada — Yes at Summer party (12 Market Street, Leeds) 15 October 8:00am - 10:00am',
    );

    expect(
      interpolateFormEmailText(
        '{{submitter_name}} {{submitter_email}} {{form_title}} {{field_attendance}} {{submission_url}}',
        vars,
      ),
    ).toBe(
      'Ada ada@example.com Summer party Yes https://ozer.so/app/studio/forms/form-1',
    );
  });

  it('escapes user values in HTML interpolation but keeps answers HTML', () => {
    const html = interpolateFormEmailHtml('<p>Hi {{name}}</p>{{answers}}', {
      name: 'Ada <script>',
      answers: '<p>safe</p>',
    });
    expect(html).toBe('<p>Hi Ada &lt;script&gt;</p><p>safe</p>');
  });

  it('lists submitted answers and renders a label/value block', () => {
    const fields = workspaceFormFieldsForTemplate('rsvp');
    const answers = listFormSubmittedAnswers({
      fields,
      values: {
        name: 'Ada',
        email: 'ada@example.com',
        attendance: 'Yes',
        guests: '2',
      },
    });

    expect(answers.map((item) => item.key)).toEqual([
      'name',
      'email',
      'attendance',
      'guests',
      'dietary',
      'message',
    ]);
    expect(answers.find((item) => item.key === 'attendance')).toEqual({
      key: 'attendance',
      label: 'Will you attend?',
      value: 'Yes',
    });

    const block = renderFormAnswersHtml(
      answers,
      'https://ozer.so/app/studio/forms/form-1',
    );
    expect(block).toContain('Submitted answers');
    expect(block).toContain('Will you attend?');
    expect(block).toContain('Yes');
    expect(block).toContain('Open submissions in Ozer');
  });

  it('escapes submitted values inside the answers HTML block', () => {
    const block = renderFormAnswersHtml(
      [
        {
          key: 'message',
          label: 'Message',
          value: '<img src=x onerror=alert(1)>',
        },
      ],
      'https://ozer.so/app/studio/forms/form-1',
    );
    expect(block).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(block).not.toContain('<img src=x');
  });

  it('uses escaped answers HTML when interpolating {{answers}}', () => {
    const answersHtml = renderFormAnswersHtml([
      { key: 'message', label: 'Message', value: 'Ada <script>' },
    ]);
    const html = interpolateFormEmailHtml(
      '<p>Copy: {{answers}}</p>',
      withFormEmailHtmlVars({ name: 'Ada' }, answersHtml),
    );
    expect(html).toContain('Ada &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('appends answers unless the template already uses {{answers}}', () => {
    const answersHtml = '<div>Answers</div>';
    const appended = composeFormNotificationBody({
      bodyHtml: '<p>Hello {{name}}</p>',
      vars: { name: 'Ada' },
      includeSubmittedAnswers: true,
      answersHtml,
    });
    expect(appended).toBe('<p>Hello Ada</p><div>Answers</div>');

    const placed = composeFormNotificationBody({
      bodyHtml: '<p>{{answers}}</p>',
      vars: { name: 'Ada' },
      includeSubmittedAnswers: true,
      answersHtml,
    });
    expect(placed).toBe('<p><div>Answers</div></p>');

    const skipped = composeFormNotificationBody({
      bodyHtml: '<p>Hello {{name}}</p>',
      vars: { name: 'Ada' },
      includeSubmittedAnswers: false,
      answersHtml,
    });
    expect(skipped).toBe('<p>Hello Ada</p>');
  });

  it('lists builtin and field merge tokens', () => {
    const tokens = listFormEmailMergeTokens(
      workspaceFormFieldsForTemplate('rsvp'),
    );
    expect(tokens.some((item) => item.token === '{{event_date}}')).toBe(true);
    expect(tokens.some((item) => item.token === '{{event_time}}')).toBe(true);
    expect(tokens.some((item) => item.token === '{{answers}}')).toBe(true);
    expect(tokens.some((item) => item.token === '{{attendance}}')).toBe(true);
    expect(tokens.some((item) => item.token === '{{name}}')).toBe(true);
    expect(tokens.filter((item) => item.token === '{{name}}')).toHaveLength(1);
  });
});
