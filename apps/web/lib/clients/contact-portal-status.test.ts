import { describe, expect, it } from 'vitest';

import {
  PORTAL_STATUS_BADGE_CLASS,
  isVisiblePortalStatus,
  portalStatusBadgeClass,
  portalStatusDisplayLabel,
} from './contact-portal-status';

describe('contact portal status pills', () => {
  it('labels only the statuses shown as pills', () => {
    expect(portalStatusDisplayLabel('active')).toBe('Active');
    expect(portalStatusDisplayLabel('invited')).toBe('Invited');
    expect(portalStatusDisplayLabel('revoked')).toBe('Revoked');
    expect(portalStatusDisplayLabel('not_invited')).toBeNull();
    expect(portalStatusDisplayLabel(undefined)).toBeNull();
  });

  it('colours Active green, Invited gold, and Revoked destructive', () => {
    expect(isVisiblePortalStatus('active')).toBe(true);
    expect(isVisiblePortalStatus('invited')).toBe(true);
    expect(isVisiblePortalStatus('revoked')).toBe(true);
    expect(portalStatusBadgeClass('active')).toBe(
      PORTAL_STATUS_BADGE_CLASS.active,
    );
    expect(portalStatusBadgeClass('invited')).toBe(
      PORTAL_STATUS_BADGE_CLASS.invited,
    );
    expect(portalStatusBadgeClass('revoked')).toBe(
      PORTAL_STATUS_BADGE_CLASS.revoked,
    );
    expect(PORTAL_STATUS_BADGE_CLASS.active).toContain('emerald');
    expect(PORTAL_STATUS_BADGE_CLASS.invited).toContain('--ozer-gold-500');
    expect(PORTAL_STATUS_BADGE_CLASS.revoked).toContain('red');
  });

  it('does not invent a pill for not_invited', () => {
    expect(isVisiblePortalStatus('not_invited')).toBe(false);
    expect(portalStatusBadgeClass('not_invited')).toBeNull();
  });
});
