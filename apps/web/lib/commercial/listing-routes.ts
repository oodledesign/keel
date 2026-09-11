import pathsConfig from '~/config/paths.config';

export type ListingTabKey =
  | 'marketing'
  | 'media'
  | 'management'
  | 'overview'
  | 'publishing'
  | 'interest'
  | 'edit';

export function listingDetailHref(accountSlug: string, listingId: string) {
  return pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId);
}

export function listingTabHref(
  accountSlug: string,
  listingId: string,
  tab: ListingTabKey,
) {
  const base = listingDetailHref(accountSlug, listingId);
  if (tab === 'overview') return base;
  if (tab === 'edit') {
    return pathsConfig.app.accountListingEdit
      .replace('[account]', accountSlug)
      .replace('[id]', listingId);
  }
  return `${base}/${tab}`;
}

/** Status lives on the disposal Edit form. */
export function listingEditStatusHref(accountSlug: string, listingId: string) {
  return listingTabHref(accountSlug, listingId, 'edit');
}

export function workspacePublishingHref(accountSlug: string) {
  return pathsConfig.app.accountCommercialPublishing.replace(
    '[account]',
    accountSlug,
  );
}
