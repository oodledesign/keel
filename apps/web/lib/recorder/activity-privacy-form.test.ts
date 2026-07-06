import { describe, expect, it } from 'vitest';

import {
  buildActivityPrivacyFormDefaults,
  formValuesToSettings,
  formatLineList,
  parseLineList,
} from '~/home/[account]/settings/activity/_lib/activity-privacy-form';

describe('activity privacy form helpers', () => {
  it('parses and formats line lists', () => {
    expect(parseLineList(' Safari \n\ncom.apple.Safari \n')).toEqual([
      'Safari',
      'com.apple.Safari',
    ]);
    expect(formatLineList(['github.com', 'notion.so'])).toBe(
      'github.com\nnotion.so',
    );
  });

  it('defaults tracking to disabled', () => {
    expect(buildActivityPrivacyFormDefaults(null)).toEqual({
      tracking_enabled: false,
      capture_full_urls: false,
      idle_threshold_seconds: 120,
      excluded_apps_text: '',
      excluded_domains_text: '',
    });
  });

  it('maps form values to persisted settings', () => {
    expect(
      formValuesToSettings({
        tracking_enabled: true,
        capture_full_urls: false,
        idle_threshold_seconds: 180,
        excluded_apps_text: '1Password',
        excluded_domains_text: 'bank.example.com',
      }),
    ).toEqual({
      tracking_enabled: true,
      capture_full_urls: false,
      idle_threshold_seconds: 180,
      excluded_apps: ['1Password'],
      excluded_domains: ['bank.example.com'],
    });
  });
});
