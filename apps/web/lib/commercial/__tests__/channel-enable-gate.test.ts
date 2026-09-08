import { describe, expect, it } from 'vitest';

import {
  channelEnableCanContinue,
  createChannelEnableGate,
} from '../channel-enable-gate';

describe('createChannelEnableGate', () => {
  it('resolves true when Continue settles allow without dismiss', async () => {
    const gate = createChannelEnableGate();
    const pending = gate.request();
    gate.settle(true);
    await expect(pending).resolves.toBe(true);
  });

  it('resolves false when the dialog is dismissed', async () => {
    const gate = createChannelEnableGate();
    const pending = gate.request();
    gate.settle(false);
    await expect(pending).resolves.toBe(false);
  });

  it('keeps the first settlement when dismiss runs before Continue', async () => {
    const gate = createChannelEnableGate();
    const pending = gate.request();
    gate.settle(false);
    gate.settle(true);
    await expect(pending).resolves.toBe(false);
  });

  it('keeps Continue when a later dismiss fires after settle', async () => {
    const gate = createChannelEnableGate();
    const pending = gate.request();
    gate.settle(true);
    gate.settle(false);
    await expect(pending).resolves.toBe(true);
  });
});

describe('channelEnableCanContinue', () => {
  it('allows Continue when the channel can enable and extras are soft', () => {
    expect(
      channelEnableCanContinue({
        canEnable: true,
        extraRequired: [{ severity: 'checklist' }],
      }),
    ).toBe(true);
  });

  it('blocks Continue when the channel cannot enable', () => {
    expect(channelEnableCanContinue({ canEnable: false })).toBe(false);
  });

  it('blocks Continue when an extra required item remains', () => {
    expect(
      channelEnableCanContinue({
        canEnable: true,
        extraRequired: [{ severity: 'required' }],
      }),
    ).toBe(false);
  });
});
