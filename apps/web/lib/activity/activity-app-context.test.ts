import { describe, expect, it } from 'vitest';

import type { ActivityBlockListRow } from '~/lib/activity/activity-history';
import {
  blockContextLabel,
  inferActivityRuleMatch,
  parseActivityAppContext,
} from '~/lib/activity/activity-app-context';

function makeBlock(
  overrides: Partial<ActivityBlockListRow> & Pick<ActivityBlockListRow, 'id' | 'startedAt'>,
): ActivityBlockListRow {
  return {
    userId: 'user-1',
    userName: 'Dan',
    appName: 'Cursor',
    bundleId: 'com.todesktop.cursor',
    domain: null,
    url: null,
    windowTitle: 'keel',
    endedAt: overrides.startedAt.replace('T10:', 'T10:05:'),
    durationSeconds: 300,
    projectId: null,
    projectName: null,
    clientId: null,
    clientName: null,
    confidenceScore: null,
    isConfirmed: false,
    isExcluded: false,
    ...overrides,
  };
}

describe('activity app context parsing', () => {
  it('parses IDE repo and file titles', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'ide',
          startedAt: '2026-07-07T10:00:00.000Z',
          windowTitle: 'keel - activity-page-content.tsx - Cursor',
        }),
      ),
    ).toEqual({
      kind: 'ide',
      item: 'keel',
      detail: 'activity-page-content.tsx',
      meta: null,
      context: null,
    });
  });

  it('parses Figma project and page titles', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'figma',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Figma',
          bundleId: 'com.figma.Desktop',
          windowTitle: 'Homepage - Marketing Site - Figma',
        }),
      ),
    ).toEqual({
      kind: 'design',
      item: 'Marketing Site',
      detail: 'Homepage',
      meta: null,
      context: null,
    });
  });

  it('parses Illustrator document titles', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'ai',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Adobe Illustrator',
          bundleId: 'com.adobe.illustrator',
          windowTitle: 'logo-mark.ai @ 100% (RGB/Preview)',
        }),
      ),
    ).toEqual({
      kind: 'design',
      item: 'logo-mark.ai',
      detail: 'RGB/Preview',
      meta: null,
      context: null,
    });
  });

  it('parses Microsoft Word document titles', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'word',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Microsoft Word',
          bundleId: 'com.microsoft.Word',
          windowTitle: 'Proposal v2 - Microsoft Word',
        }),
      ),
    ).toEqual({
      kind: 'document',
      item: 'Proposal v2',
      detail: null,
      meta: null,
      context: null,
    });
  });

  it('parses Google Docs titles from browser windows', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'gdocs',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Google Chrome',
          bundleId: 'com.google.Chrome',
          domain: 'docs.google.com',
          windowTitle: 'Q3 Budget - Google Docs',
        }),
      ),
    ).toEqual({
      kind: 'document',
      item: 'Q3 Budget',
      detail: 'Google Docs',
      meta: 'Google Docs',
      context: null,
    });
  });

  it('parses Google Sheets titles from browser windows', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'gsheets',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Safari',
          bundleId: 'com.apple.Safari',
          domain: 'sheets.google.com',
          windowTitle: 'Pipeline tracker - Google Sheets',
        }),
      ),
    ).toMatchObject({
      kind: 'document',
      item: 'Pipeline tracker',
      meta: 'Google Sheets',
    });
  });

  it('parses email subjects from Outlook and Spark', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'outlook',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Microsoft Outlook',
          bundleId: 'com.microsoft.Outlook',
          windowTitle: 'Invoice follow-up - Outlook',
        }),
      ),
    ).toEqual({
      kind: 'email',
      item: 'Invoice follow-up',
      detail: null,
      meta: null,
      context: null,
    });

    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'spark',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Spark',
          bundleId: 'com.readdle.SparkDesktop',
          windowTitle: 'Re: Website launch plan - Spark',
        }),
      ),
    ).toMatchObject({
      kind: 'email',
      item: 'Re: Website launch plan',
      meta: 'Reply',
    });
  });

  it('parses Apple Mail subjects with mailbox detail', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'mail',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Mail',
          bundleId: 'com.apple.mail',
          windowTitle: 'Contract review - Inbox',
        }),
      ),
    ).toEqual({
      kind: 'email',
      item: 'Contract review',
      detail: 'Inbox',
      meta: null,
      context: null,
    });
  });

  it('ignores generic inbox window titles', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'inbox',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Mail',
          bundleId: 'com.apple.mail',
          windowTitle: 'Inbox',
        }),
      ),
    ).toBeNull();
  });

  it('parses Gmail web subjects from browser titles', () => {
    expect(
      parseActivityAppContext(
        makeBlock({
          id: 'gmail',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Google Chrome',
          bundleId: 'com.google.Chrome',
          domain: 'mail.google.com',
          windowTitle: 'Re: Launch checklist - Gmail',
        }),
      ),
    ).toMatchObject({
      kind: 'email',
      item: 'Re: Launch checklist',
      meta: 'Reply',
    });
  });

  it('labels IDE workspace-only sessions', () => {
    const block = makeBlock({
      id: 'workspace',
      startedAt: '2026-07-07T10:00:00.000Z',
      windowTitle: 'keel - Cursor',
    });

    expect(blockContextLabel(block)).toBe('Workspace');
  });

  it('infers granular remember rules from project and file titles', () => {
    expect(
      inferActivityRuleMatch(
        makeBlock({
          id: 'ai',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Adobe Illustrator',
          bundleId: 'com.adobe.illustrator',
          windowTitle: 'logo-mark.ai @ 100% (RGB/Preview)',
        }),
      ),
    ).toEqual({
      matchType: 'title_contains',
      matchValue: 'logo-mark.ai',
      label: 'logo-mark.ai',
    });

    expect(
      inferActivityRuleMatch(
        makeBlock({
          id: 'figma',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Figma',
          bundleId: 'com.figma.Desktop',
          windowTitle: 'Homepage - Marketing Site - Figma',
        }),
      ),
    ).toEqual({
      matchType: 'title_contains',
      matchValue: 'Marketing Site',
      label: 'Marketing Site · Homepage',
    });

    expect(
      inferActivityRuleMatch(
        makeBlock({
          id: 'ide',
          startedAt: '2026-07-07T10:00:00.000Z',
          windowTitle: 'keel - activity-page-content.tsx - Cursor',
        }),
      ),
    ).toEqual({
      matchType: 'title_contains',
      matchValue: 'keel',
      label: 'keel project',
    });

    expect(
      inferActivityRuleMatch(
        makeBlock({
          id: 'gdocs',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Google Chrome',
          bundleId: 'com.google.Chrome',
          domain: 'docs.google.com',
          windowTitle: 'Q3 Budget - Google Docs',
        }),
      ),
    ).toEqual({
      matchType: 'title_contains',
      matchValue: 'Q3 Budget',
      label: 'Q3 Budget',
    });
  });

  it('falls back to domain or app rules when no specific title exists', () => {
    expect(
      inferActivityRuleMatch(
        makeBlock({
          id: 'browser',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Safari',
          bundleId: 'com.apple.Safari',
          domain: 'github.com',
          windowTitle: 'GitHub',
        }),
      ),
    ).toEqual({
      matchType: 'domain',
      matchValue: 'github.com',
      label: 'github.com',
    });

    expect(
      inferActivityRuleMatch(
        makeBlock({
          id: 'illustrator',
          startedAt: '2026-07-07T10:00:00.000Z',
          appName: 'Adobe Illustrator',
          bundleId: 'com.adobe.illustrator',
          windowTitle: 'Adobe Illustrator',
        }),
      ),
    ).toEqual({
      matchType: 'app_name',
      matchValue: 'Adobe Illustrator',
      label: 'Adobe Illustrator',
    });
  });
});
