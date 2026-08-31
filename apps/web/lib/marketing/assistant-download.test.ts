import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  OZER_ASSISTANT_DOWNLOAD,
  isAssistantDownloadFilePath,
} from './assistant-download';
import { getFeaturePageConfig } from './feature-landing-pages';

describe('OZER_ASSISTANT_DOWNLOAD', () => {
  it('points at the public zip path (www.ozer.so/downloads/...)', () => {
    expect(OZER_ASSISTANT_DOWNLOAD.filePath).toBe(
      '/downloads/OzerAssistant-1.0.zip',
    );
    expect(OZER_ASSISTANT_DOWNLOAD.fileName).toBe('OzerAssistant-1.0.zip');
    expect(OZER_ASSISTANT_DOWNLOAD.latestFilePath).toBe(
      '/downloads/OzerAssistant-latest.zip',
    );
    expect(OZER_ASSISTANT_DOWNLOAD.appcastPath).toBe('/downloads/appcast.xml');
    expect(OZER_ASSISTANT_DOWNLOAD.pagePath).toBe('/download');
    expect(OZER_ASSISTANT_DOWNLOAD.aliasPath).toBe('/assistant');
  });

  it('describes version 1.0 (16) for Apple Silicon on macOS 15+', () => {
    expect(OZER_ASSISTANT_DOWNLOAD.versionLabel).toBe('1.0 (16)');
    expect(OZER_ASSISTANT_DOWNLOAD.minOs).toBe('macOS 15+');
    expect(OZER_ASSISTANT_DOWNLOAD.architecture).toBe('Apple Silicon');
    expect(OZER_ASSISTANT_DOWNLOAD.developerTeamId).toBe('463T9J3286');
  });

  it('detects the zip as a direct file download', () => {
    expect(isAssistantDownloadFilePath(OZER_ASSISTANT_DOWNLOAD.filePath)).toBe(
      true,
    );
    expect(
      isAssistantDownloadFilePath(OZER_ASSISTANT_DOWNLOAD.latestFilePath),
    ).toBe(true);
    expect(isAssistantDownloadFilePath('/download')).toBe(false);
    expect(
      isAssistantDownloadFilePath(OZER_ASSISTANT_DOWNLOAD.appcastPath),
    ).toBe(false);
    expect(isAssistantDownloadFilePath('/templates/example.zip')).toBe(false);
  });

  it('points Assistant feature pages at the download landing', () => {
    for (const slug of [
      'desktop-assistant',
      'activity',
      'dictation',
    ] as const) {
      expect(getFeaturePageConfig(slug).secondaryCta?.href).toBe(
        OZER_ASSISTANT_DOWNLOAD.pagePath,
      );
    }
  });

  it('ships a valid empty Sparkle RSS channel titled Ozer Assistant', () => {
    const xml = readFileSync(
      path.resolve(__dirname, '../../public/downloads/appcast.xml'),
      'utf8',
    );

    expect(xml).toContain('xmlns:sparkle=');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>Ozer Assistant</title>');
    expect(xml).toContain('https://www.ozer.so/downloads/appcast.xml');
    expect(xml).not.toMatch(/<enclosure\b/);
    expect(xml).not.toMatch(/sparkle:edSignature=/);
  });
});
