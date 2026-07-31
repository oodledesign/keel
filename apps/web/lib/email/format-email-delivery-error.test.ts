import { describe, expect, it } from 'vitest';

import {
  extractErrorMessage,
  formatEmailDeliveryError,
} from './format-email-delivery-error';

describe('formatEmailDeliveryError', () => {
  it('serializes plain object mailer errors instead of [object Object]', () => {
    const error = {
      error: {
        code: 'TM_4001',
        message: 'Invalid from address',
      },
    };

    expect(extractErrorMessage(error)).toContain('Invalid from address');
    expect(formatEmailDeliveryError(error)).toContain('Invalid from address');
    expect(formatEmailDeliveryError(error)).not.toBe('[object Object]');
  });

  it('recovers details when Error.message is [object Object]', () => {
    const error = Object.assign(new Error('[object Object]'), {
      data: { error: { code: 'TM_4001', message: 'Domain not verified' } },
    });

    expect(formatEmailDeliveryError(error)).toContain('Domain not verified');
  });

  it('explains ZeptoMail resource / daily limit errors', () => {
    expect(formatEmailDeliveryError('Resource Limit Exhausted.')).toContain(
      'ZeptoMail send limit',
    );
    expect(
      formatEmailDeliveryError({ error: { code: 'SM_151', message: 'limit' } }),
    ).toContain('ZeptoMail send limit');
  });
});
