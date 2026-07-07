import { describe, expect, it } from 'vitest';

import { resolveActivityAppIcon } from '~/lib/activity/activity-app-icons';

describe('resolveActivityAppIcon', () => {
  it('maps Chrome bundle id to a favicon host', () => {
    const icon = resolveActivityAppIcon({
      appName: 'Google Chrome',
      bundleId: 'com.google.Chrome',
      domain: null,
    });

    expect(icon.src).toContain('google.com');
    expect(icon.fallback).toBe('GC');
  });

  it('maps Cursor bundle id to cursor.com', () => {
    const icon = resolveActivityAppIcon({
      appName: 'Cursor',
      bundleId: 'com.todesktop.cursor',
      domain: null,
    });

    expect(icon.src).toContain('cursor.com');
  });

  it('falls back to domain favicon for browser blocks', () => {
    const icon = resolveActivityAppIcon({
      appName: 'Google Chrome',
      bundleId: 'com.google.Chrome',
      domain: 'github.com',
    });

    expect(icon.src).toContain('google.com');
  });
});
