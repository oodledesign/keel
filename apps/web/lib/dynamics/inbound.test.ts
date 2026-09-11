import { describe, expect, it } from 'vitest';

import {
  applyDynamicsDoNotEmailToOzer,
  describeFutureDynamicsInboundPause,
} from './inbound';

describe('dynamics inbound pause stub', () => {
  it('documents that Dynamics is not consent source of truth yet', () => {
    expect(describeFutureDynamicsInboundPause()).toEqual({
      status: 'not_implemented',
      summary: expect.stringContaining('Do not treat Dataverse as consent'),
    });
  });

  it('refuses to apply inbound do-not-email', async () => {
    await expect(
      applyDynamicsDoNotEmailToOzer({
        accountId: '11111111-1111-4111-8111-111111111111',
        email: 'ada@example.com',
        donotemail: true,
      }),
    ).rejects.toThrow(/not_implemented|Do not treat Dataverse/i);
  });
});
