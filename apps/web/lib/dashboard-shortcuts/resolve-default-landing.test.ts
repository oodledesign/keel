import { describe, expect, it } from 'vitest';

import pathsConfig from '~/config/paths.config';

import { SHORTCUT_CATALOG_ROUTE } from './catalog-ids';
import {
  isWorkspaceLandingHref,
  resolveDefaultLandingHref,
  workspaceHomeLandingPage,
} from './resolve-default-landing';

describe('default landing workspace page', () => {
  it('treats workspace home and nested pages as in-workspace', () => {
    expect(isWorkspaceLandingHref('/app/oodle', 'oodle')).toBe(true);
    expect(isWorkspaceLandingHref('/app/oodle/email-campaigns', 'oodle')).toBe(
      true,
    );
    expect(isWorkspaceLandingHref('/app/other/email-campaigns', 'oodle')).toBe(
      false,
    );
  });

  it('falls back to workspace home when no page is stored', () => {
    expect(
      resolveDefaultLandingHref({
        type: 'workspace',
        workspaceSlug: 'oodle',
        catalogId: null,
        params: {},
      }),
    ).toBe(pathsConfig.app.accountHome.replace('[account]', 'oodle'));
  });

  it('resolves a stored app.route page inside the workspace', () => {
    const campaigns = '/app/oodle/email-campaigns';
    expect(
      resolveDefaultLandingHref({
        type: 'workspace',
        workspaceSlug: 'oodle',
        catalogId: SHORTCUT_CATALOG_ROUTE,
        params: { href: campaigns },
      }),
    ).toBe(campaigns);
  });

  it('rejects a page that belongs to another workspace', () => {
    expect(
      resolveDefaultLandingHref({
        type: 'workspace',
        workspaceSlug: 'oodle',
        catalogId: SHORTCUT_CATALOG_ROUTE,
        params: { href: '/app/other/email-campaigns' },
      }),
    ).toBe(pathsConfig.app.accountHome.replace('[account]', 'oodle'));
  });

  it('builds a workspace-home catalog option', () => {
    expect(workspaceHomeLandingPage('oodle')).toMatchObject({
      catalogId: SHORTCUT_CATALOG_ROUTE,
      label: 'Workspace home',
      href: '/app/oodle',
    });
  });
});
