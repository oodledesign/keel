import { NativeHttpError } from './http';

export type NativeDevicePlatform = 'ios';

export function parseNativeDevicePlatform(
  value: string | null | undefined,
): NativeDevicePlatform {
  const trimmed = value?.trim().toLowerCase() ?? '';
  if (trimmed === 'ios' || trimmed === '') {
    return 'ios';
  }

  throw new NativeHttpError(400, 'platform must be ios');
}

export function parseNativeDeviceToken(value: unknown) {
  if (typeof value !== 'string') {
    throw new NativeHttpError(400, 'token is required');
  }

  const token = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    throw new NativeHttpError(
      400,
      'token must be a 64-character hex device token',
    );
  }

  return token;
}
