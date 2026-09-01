import { describe, expect, it } from 'vitest';

import {
  parseNativeDevicePlatform,
  parseNativeDeviceToken,
} from './devices-shared';
import { NativeHttpError } from './http';

describe('parseNativeDeviceToken', () => {
  it('accepts a 64-character hex token', () => {
    const token = 'a'.repeat(64);
    expect(parseNativeDeviceToken(token)).toBe(token);
  });

  it('rejects junk', () => {
    expect(() => parseNativeDeviceToken('not-a-token')).toThrow(
      NativeHttpError,
    );
    expect(() => parseNativeDeviceToken('')).toThrow(NativeHttpError);
  });
});

describe('parseNativeDevicePlatform', () => {
  it('defaults to ios', () => {
    expect(parseNativeDevicePlatform(undefined)).toBe('ios');
    expect(parseNativeDevicePlatform('ios')).toBe('ios');
  });

  it('rejects other platforms', () => {
    expect(() => parseNativeDevicePlatform('android')).toThrow(NativeHttpError);
  });
});
