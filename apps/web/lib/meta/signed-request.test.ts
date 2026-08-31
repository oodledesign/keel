import { describe, expect, it } from 'vitest';

import {
  createMetaSignedRequest,
  parseMetaSignedRequest,
} from './signed-request';

const secret = 'test-app-secret';
const otherSecret = 'instagram-only-secret';

const payload = {
  algorithm: 'HMAC-SHA256',
  user_id: '17841400000000000',
  issued_at: 1_700_000_000,
};

describe('parseMetaSignedRequest', () => {
  it('verifies a valid signed_request', () => {
    const signed = createMetaSignedRequest(payload, secret);

    expect(parseMetaSignedRequest(signed, [secret])).toEqual(payload);
  });

  it('tries secrets in order and accepts a later match', () => {
    const signed = createMetaSignedRequest(payload, otherSecret);

    expect(parseMetaSignedRequest(signed, [secret, otherSecret])).toMatchObject(
      { user_id: payload.user_id },
    );
  });

  it('rejects a tampered signature', () => {
    const signed = createMetaSignedRequest(payload, secret);
    const [, encodedPayload] = signed.split('.');

    expect(
      parseMetaSignedRequest(`aaaa.${encodedPayload}`, [secret]),
    ).toBeNull();
  });

  it('rejects the wrong secret', () => {
    const signed = createMetaSignedRequest(payload, secret);

    expect(parseMetaSignedRequest(signed, [otherSecret])).toBeNull();
  });

  it('rejects a payload without a user id', () => {
    const signed = createMetaSignedRequest(
      { algorithm: 'HMAC-SHA256', user_id: '' },
      secret,
    );

    expect(parseMetaSignedRequest(signed, [secret])).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseMetaSignedRequest('', [secret])).toBeNull();
    expect(parseMetaSignedRequest('noperiod', [secret])).toBeNull();
    expect(parseMetaSignedRequest(payload.user_id, [])).toBeNull();
  });
});
