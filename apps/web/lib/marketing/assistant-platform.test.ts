import { describe, expect, it } from 'vitest';

import {
  assistantDownloadMailto,
  isMacDesktopClient,
} from './assistant-platform';

describe('isMacDesktopClient', () => {
  it('detects desktop Safari on macOS', () => {
    expect(
      isMacDesktopClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      ),
    ).toBe(true);
  });

  it('rejects iPhone Safari', () => {
    expect(
      isMacDesktopClient(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe(false);
  });

  it('rejects iPadOS that spoofs Macintosh', () => {
    expect(
      isMacDesktopClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        5,
      ),
    ).toBe(false);
  });
});

describe('assistantDownloadMailto', () => {
  it('addresses the signed-in user when email is known', () => {
    const href = assistantDownloadMailto(
      'dan@oodle.design',
      'https://www.ozer.so/downloads/OzerAssistant-latest.zip',
    );
    expect(href.startsWith('mailto:dan%40oodle.design?')).toBe(true);
    expect(href).toContain('OzerAssistant-latest.zip');
  });
});
