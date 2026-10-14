import { describe, expect, it } from 'vitest';

import {
  normaliseEmail,
  normaliseUkPhone,
  parseConsentAnswer,
  validateCollectedValue,
} from './collect-validate';
import {
  buildEntryPayload,
  buildFollowCheckPayload,
  buildRunPayload,
  parseEntryPayload,
  parseFollowCheckPayload,
  parseRunPayload,
  renderTemplate,
} from './payload';
import {
  IG_GOTO_END,
  type IgStep,
  igStepInputSchema,
  parseStoredStep,
  resolveGoto,
  validateIgSequence,
} from './step-types';
import {
  chooseRecipient,
  isWithinMessagingWindow,
  nextRetryAt,
} from './window';

const RUN_ID = '3f2b8c1e-8d4a-4c7b-9a0e-1b2c3d4e5f60';
const NOW = new Date('2026-10-14T12:00:00Z');
const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();

describe('messaging window', () => {
  it('is open within 24 hours of the last inbound message', () => {
    expect(isWithinMessagingWindow(hoursAgo(23), NOW)).toBe(true);
    expect(isWithinMessagingWindow(hoursAgo(25), NOW)).toBe(false);
    expect(isWithinMessagingWindow(null, NOW)).toBe(false);
  });

  it('uses an unused private reply first for comment runs', () => {
    expect(
      chooseRecipient({
        lastInboundAt: null,
        sourceCommentId: 'c1',
        privateReplyUsed: false,
        runCreatedAt: hoursAgo(1),
        now: NOW,
      }),
    ).toEqual({ kind: 'private_reply', commentId: 'c1' });
  });

  it('sends direct once the private reply is used and the user has replied', () => {
    expect(
      chooseRecipient({
        lastInboundAt: hoursAgo(0.1),
        sourceCommentId: 'c1',
        privateReplyUsed: true,
        runCreatedAt: hoursAgo(1),
        now: NOW,
      }),
    ).toEqual({ kind: 'direct' });
  });

  it('is closed after the private reply is used with no reply', () => {
    expect(
      chooseRecipient({
        lastInboundAt: null,
        sourceCommentId: 'c1',
        privateReplyUsed: true,
        runCreatedAt: hoursAgo(1),
        now: NOW,
      }),
    ).toEqual({ kind: 'closed' });
  });

  it('does not use a private reply for comments older than 7 days', () => {
    expect(
      chooseRecipient({
        lastInboundAt: null,
        sourceCommentId: 'c1',
        privateReplyUsed: false,
        runCreatedAt: hoursAgo(24 * 8),
        now: NOW,
      }).kind,
    ).toBe('closed');
  });

  it('backs off 1, 5 then 15 minutes and then gives up', () => {
    expect(nextRetryAt(1, NOW)?.getTime()).toBe(NOW.getTime() + 60_000);
    expect(nextRetryAt(2, NOW)?.getTime()).toBe(NOW.getTime() + 5 * 60_000);
    expect(nextRetryAt(3, NOW)?.getTime()).toBe(NOW.getTime() + 15 * 60_000);
    expect(nextRetryAt(4, NOW)).toBeNull();
  });
});

describe('payloads', () => {
  it('round-trips run payloads', () => {
    expect(parseRunPayload(buildRunPayload(RUN_ID, 2, 1))).toEqual({
      runId: RUN_ID,
      position: 2,
      choice: 1,
    });
  });

  it('rejects malformed run payloads', () => {
    expect(parseRunPayload('igrun:not-a-uuid:0:0')).toBeNull();
    expect(parseRunPayload(`igrun:${RUN_ID}:-1:0`)).toBeNull();
    expect(parseRunPayload(`igflow:${RUN_ID}:0:0`)).toBeNull();
    expect(parseRunPayload(`igrun:${RUN_ID}:0`)).toBeNull();
  });

  it('round-trips follow-check and entry payloads', () => {
    expect(parseFollowCheckPayload(buildFollowCheckPayload(RUN_ID))).toBe(
      RUN_ID,
    );
    expect(parseEntryPayload(buildEntryPayload(RUN_ID))).toBe(RUN_ID);
    expect(parseEntryPayload(`igfollow:${RUN_ID}`)).toBeNull();
  });

  it('renders placeholders and keeps line breaks', () => {
    expect(
      renderTemplate('Hi {{name}}!\n\nThanks {{username}}', {
        username: 'dan',
        name: 'Dan Potter',
      }),
    ).toBe('Hi Dan!\n\nThanks @dan');
    expect(renderTemplate('Hi {{ first_name }}', {})).toBe('Hi there');
  });
});

describe('collected data', () => {
  it('normalises email addresses', () => {
    expect(normaliseEmail('  Dan@Example.CO.UK ')).toBe('dan@example.co.uk');
    expect(normaliseEmail('not an email')).toBeNull();
  });

  it('normalises UK phone numbers to E.164', () => {
    expect(normaliseUkPhone('07700 900123')).toBe('+447700900123');
    expect(normaliseUkPhone('+44 (0)7700 900123')).toBe('+447700900123');
    expect(normaliseUkPhone('0044 7700 900123')).toBe('+447700900123');
    expect(normaliseUkPhone('020 7946 0018')).toBe('+442079460018');
    expect(normaliseUkPhone('12345')).toBeNull();
  });

  it('parses consent answers', () => {
    expect(parseConsentAnswer('Yes, I agree')).toBe(true);
    expect(parseConsentAnswer('no thanks')).toBe(false);
    expect(parseConsentAnswer('maybe')).toBeNull();
  });

  it('validates each field type', () => {
    expect(validateCollectedValue('email', 'a@b.com')).toEqual({
      ok: true,
      value: 'a@b.com',
    });
    expect(validateCollectedValue('phone', 'call me')).toEqual({ ok: false });
    expect(validateCollectedValue('name', '  Jane   Doe ')).toEqual({
      ok: true,
      value: 'Jane Doe',
    });
    expect(validateCollectedValue('name', '<script>')).toEqual({ ok: false });
    expect(validateCollectedValue('consent', 'yep')).toEqual({
      ok: true,
      value: 'yes',
    });
  });
});

function step(input: {
  step_type: string;
  config: Record<string, unknown>;
  asset_id?: string | null;
}): IgStep {
  return igStepInputSchema.parse(input);
}

describe('sequence validation', () => {
  const sendIt = step({
    step_type: 'buttons',
    config: {
      text: 'Want the voice note?',
      buttons: [{ label: 'Send it', type: 'postback' }],
    },
  });
  const audio = step({
    step_type: 'audio',
    config: {},
    asset_id: '11111111-1111-4111-8111-111111111111',
  });

  it('accepts a comment sequence that opens with a button then sends audio', () => {
    expect(
      validateIgSequence([sendIt, audio], { triggerType: 'comment_keyword' }),
    ).toEqual([]);
  });

  it('rejects media as the first message of a comment sequence', () => {
    const issues = validateIgSequence([audio, sendIt], {
      triggerType: 'comment_keyword',
    });
    expect(issues.some((i) => i.index === 0)).toBe(true);
  });

  it('allows media first for DM triggers', () => {
    expect(
      validateIgSequence([audio], { triggerType: 'first_message' }),
    ).toEqual([]);
  });

  it('rejects a delay as the last step and missing branch targets', () => {
    const delay = step({ step_type: 'delay', config: { minutes: 5 } });
    expect(
      validateIgSequence([audio, delay], { triggerType: 'dm_keyword' }).length,
    ).toBeGreaterThan(0);

    const branch = step({
      step_type: 'quick_replies',
      config: { text: 'Pick one', options: [{ label: 'A', goto: 'missing' }] },
    });
    expect(
      validateIgSequence([branch, audio], { triggerType: 'dm_keyword' }).some(
        (i) => i.message.includes('missing step'),
      ),
    ).toBe(true);
  });

  it('rejects media steps without a file', () => {
    const noFile = step({ step_type: 'image', config: {} });
    expect(
      validateIgSequence([noFile], { triggerType: 'dm_keyword' })[0]?.message,
    ).toMatch(/Choose a file/);
  });

  it('resolves branch targets by key', () => {
    const steps = [
      { config: { key: 'intro' } },
      { config: {} },
      { config: { key: 'audio' } },
    ];
    expect(resolveGoto(steps, 0, 'audio')).toBe(2);
    expect(resolveGoto(steps, 0, null)).toBe(1);
    expect(resolveGoto(steps, 0, IG_GOTO_END)).toBe(3);
    expect(resolveGoto(steps, 1, 'unknown')).toBe(2);
  });

  it('returns null for invalid stored steps', () => {
    expect(
      parseStoredStep({
        step_type: 'delay',
        config: { minutes: 0 },
        asset_id: null,
      }),
    ).toBeNull();
    expect(
      parseStoredStep({ step_type: 'nope', config: {}, asset_id: null }),
    ).toBeNull();
  });
});
