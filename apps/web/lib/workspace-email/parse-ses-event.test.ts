import { describe, expect, it } from 'vitest';

import { parseSesEventPayload, parseSnsEnvelope } from './parse-ses-event';

const deliveryPayload = {
  eventType: 'Delivery',
  mail: {
    timestamp: '2026-09-04T12:00:00.000Z',
    messageId:
      '01000123456789abcdef-00000000-0000-0000-0000-000000000001-000000',
    destination: ['ada@example.com'],
  },
  delivery: {
    timestamp: '2026-09-04T12:00:01.000Z',
    recipients: ['ada@example.com'],
  },
};

describe('parseSesEventPayload', () => {
  it('parses delivery events', () => {
    const parsed = parseSesEventPayload(deliveryPayload);
    expect(parsed).toMatchObject({
      eventType: 'delivery',
      sesMessageId: deliveryPayload.mail.messageId,
      destinationEmails: ['ada@example.com'],
    });
    expect(parsed?.eventAt).toBe('2026-09-04T12:00:01.000Z');
  });

  it('parses bounce with type metadata', () => {
    const parsed = parseSesEventPayload({
      eventType: 'Bounce',
      mail: {
        messageId: 'msg-bounce-1',
        destination: ['bob@example.com'],
      },
      bounce: {
        bounceType: 'Permanent',
        bounceSubType: 'General',
        timestamp: '2026-09-04T13:00:00.000Z',
        bouncedRecipients: [{ emailAddress: 'bob@example.com' }],
      },
    });

    expect(parsed).toMatchObject({
      eventType: 'bounce',
      sesMessageId: 'msg-bounce-1',
      bounceType: 'Permanent',
      bounceSubtype: 'General',
      destinationEmails: ['bob@example.com'],
    });
  });

  it('parses click with link url', () => {
    const parsed = parseSesEventPayload({
      eventType: 'Click',
      mail: { messageId: 'msg-click-1', destination: ['c@x.test'] },
      click: {
        timestamp: '2026-09-04T14:00:00.000Z',
        link: 'https://example.com/listing',
      },
    });

    expect(parsed).toMatchObject({
      eventType: 'click',
      linkUrl: 'https://example.com/listing',
    });
  });

  it('returns null for unknown event types', () => {
    expect(
      parseSesEventPayload({
        eventType: 'SomethingElse',
        mail: { messageId: 'x' },
      }),
    ).toBeNull();
  });

  it('returns null without message id', () => {
    expect(parseSesEventPayload({ eventType: 'Open', mail: {} })).toBeNull();
  });
});

describe('parseSnsEnvelope', () => {
  it('reads notification envelope fields', () => {
    const envelope = parseSnsEnvelope({
      Type: 'Notification',
      MessageId: 'sns-1',
      TopicArn: 'arn:aws:sns:eu-west-2:123:ozer-ses-events',
      Message: JSON.stringify(deliveryPayload),
      Timestamp: '2026-09-04T12:00:02.000Z',
      Signature: 'abc',
      SigningCertURL:
        'https://sns.eu-west-2.amazonaws.com/SimpleNotificationService.pem',
    });

    expect(envelope).toMatchObject({
      type: 'Notification',
      messageId: 'sns-1',
    });
    expect(envelope?.message).toContain('Delivery');
  });

  it('reads subscription confirmation', () => {
    const envelope = parseSnsEnvelope({
      Type: 'SubscriptionConfirmation',
      MessageId: 'sns-sub',
      SubscribeURL: 'https://sns.eu-west-2.amazonaws.com/?Action=Confirm',
      TopicArn: 'arn:aws:sns:eu-west-2:123:ozer-ses-events',
      Message: 'confirm',
    });

    expect(envelope?.type).toBe('SubscriptionConfirmation');
    expect(envelope?.subscribeUrl).toContain('Confirm');
  });
});
