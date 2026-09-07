import { describe, expect, it } from 'vitest';

import {
  buildNativeInvoicePushPayload,
  buildNativeMessagePushPayload,
  nativeInvoicePushUrl,
  nativeMessagePushUrl,
  readApnsConfig,
} from './apns-shared';

describe('nativeInvoicePushUrl', () => {
  it('uses the app custom scheme', () => {
    expect(nativeInvoicePushUrl('inv-1')).toBe('so.ozer.app://invoice/inv-1');
  });
});

describe('buildNativeInvoicePushPayload', () => {
  it('sets a paid title and deep link', () => {
    expect(
      buildNativeInvoicePushPayload({
        kind: 'paid',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-0042',
        body: 'Invoice INV-0042 paid (£125.00) by Hope via Stripe',
      }),
    ).toEqual({
      title: 'Invoice paid',
      body: 'Invoice INV-0042 paid (£125.00) by Hope via Stripe',
      invoiceId: 'inv-1',
      url: 'so.ozer.app://invoice/inv-1',
    });
  });
});

describe('nativeMessagePushUrl', () => {
  it('opens the thread in the app', () => {
    expect(nativeMessagePushUrl('thread-1', 'oodle')).toBe(
      'so.ozer.app://message/thread-1?workspace=oodle',
    );
  });
});

describe('buildNativeMessagePushPayload', () => {
  it('sets a message title and deep link', () => {
    expect(
      buildNativeMessagePushPayload({
        threadId: 'thread-1',
        workspace: 'oodle',
        title: 'Alex',
        body: 'On my way',
      }),
    ).toEqual({
      title: 'Alex',
      body: 'On my way',
      threadId: 'thread-1',
      url: 'so.ozer.app://message/thread-1?workspace=oodle',
    });
  });
});

describe('readApnsConfig', () => {
  it('returns null when the key is missing', () => {
    expect(
      readApnsConfig({
        APNS_KEY_ID: 'ABC123',
        APNS_TEAM_ID: '463T9J3286',
      }),
    ).toBeNull();
  });

  it('reads sandbox host by default', () => {
    expect(
      readApnsConfig({
        APNS_KEY_ID: 'ABC123',
        APNS_TEAM_ID: '463T9J3286',
        APNS_P8:
          '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
      }),
    ).toMatchObject({
      keyId: 'ABC123',
      teamId: '463T9J3286',
      bundleId: 'so.ozer.app',
      host: 'api.sandbox.push.apple.com',
    });
  });
});
