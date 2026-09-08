import { describe, expect, it } from 'vitest';

import {
  applyCampaignMergeFields,
  applyCampaignMergeText,
  firstNameFromDisplay,
  mergeValuesForRecipient,
} from './merge-fields';

describe('campaign merge fields', () => {
  it('takes the first word as first name', () => {
    expect(firstNameFromDisplay('Ada Lovelace', 'ada@example.com')).toBe('Ada');
    expect(firstNameFromDisplay(null, 'ada@example.com')).toBe('ada');
  });

  it('falls back to the email local-part when the contact has no name', () => {
    expect(firstNameFromDisplay(null, 'hello@oodle.design')).toBe('hello');
    expect(firstNameFromDisplay('', 'hello@oodle.design')).toBe('hello');
    expect(firstNameFromDisplay('   ', 'dan@oodle.design')).toBe('dan');
    expect(firstNameFromDisplay(',', 'hello@oodle.design')).toBe('hello');
    expect(
      firstNameFromDisplay('hello@oodle.design', 'hello@oodle.design'),
    ).toBe('hello');
    expect(firstNameFromDisplay(null, 'dan@oodle.design')).toBe('dan');
  });

  it('falls back to there when email has no local-part', () => {
    expect(firstNameFromDisplay(null, '@oodle.design')).toBe('there');
    expect(firstNameFromDisplay(null, '')).toBe('there');
  });

  it('substitutes tokens and escapes HTML', () => {
    const values = mergeValuesForRecipient({
      displayName: 'Ada <script>',
      email: 'ada@example.com',
      formUrl: 'https://app.ozer.test/share/form/tok?email=ada%40example.com',
    });
    const html = applyCampaignMergeFields(
      '<p>Hi {{name}} ({{email}})</p><a href="{{form_url}}">Form</a>',
      values,
    );
    expect(html).toContain('Ada &lt;script&gt;');
    expect(html).toContain('ada@example.com');
    expect(html).not.toContain('<script>');
    expect(html).toContain(
      'https://app.ozer.test/share/form/tok?email=ada%40example.com'.replaceAll(
        '&',
        '&amp;',
      ),
    );
  });

  it('merges the same tags in the subject without HTML-escaping', () => {
    const values = mergeValuesForRecipient({
      displayName: 'Ada & Co',
      email: 'ada@example.com',
      formUrl: 'https://app.ozer.test/share/form/tok',
    });

    expect(
      applyCampaignMergeText("You're invited, {{first_name}}", values),
    ).toBe("You're invited, Ada");
    expect(
      applyCampaignMergeText('A note for {{name}} — {{form_url}}', values),
    ).toBe('A note for Ada & Co — https://app.ozer.test/share/form/tok');
    expect(applyCampaignMergeText('Reply to {{email}}', values)).toBe(
      'Reply to ada@example.com',
    );
  });

  it('personalizes subject and body for nameless recipients', () => {
    const values = mergeValuesForRecipient({
      displayName: null,
      email: 'hello@oodle.design',
      formUrl: 'https://app.ozer.test/f/invite',
    });

    expect(values.firstName).toBe('hello');
    expect(values.firstName.length).toBeGreaterThan(0);

    const subject = applyCampaignMergeText(
      "You're invited, {{first_name}}",
      values,
    );
    const body = applyCampaignMergeFields(
      '<p>{{first_name}}, you&apos;re Invited to breakfast. <a href="{{form_url}}">RSVP</a></p>',
      values,
    );

    expect(subject).toBe("You're invited, hello");
    expect(subject).not.toContain('{{first_name}}');
    expect(body).toContain('hello, you&apos;re Invited to breakfast.');
    expect(body).not.toContain('{{first_name}}');
    expect(body).toContain('https://app.ozer.test/f/invite');
    expect(body).not.toContain('{{form_url}}');
  });

  it('trims leftover commas when a merge value is empty', () => {
    const empty = {
      name: '',
      firstName: '',
      email: 'hello@oodle.design',
    };

    expect(
      applyCampaignMergeText("You're invited, {{first_name}}", empty),
    ).toBe("You're invited");
    expect(
      applyCampaignMergeText("{{first_name}}, you're Invited", empty),
    ).toBe("you're Invited");
    expect(
      applyCampaignMergeFields(
        '<p>{{first_name}}, you&apos;re Invited</p>',
        empty,
      ),
    ).toBe('<p>you&apos;re Invited</p>');
  });
});
