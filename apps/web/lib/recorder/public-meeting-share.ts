import { getAppSiteOrigin } from '~/lib/app-host-routing';

export function buildPublicMeetingSharePath(token: string) {
  return `/share/meetings/${token}`;
}

export function buildPublicMeetingShareUrl(token: string, origin?: string) {
  const base = (origin ?? getAppSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildPublicMeetingSharePath(token)}`;
}
