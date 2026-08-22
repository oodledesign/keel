import pathsConfig from '~/config/paths.config';

export type NewDisposalUrlOptions = {
  name?: string | null;
  notes?: string | null;
  askingRent?: string | null;
  clientId?: string | null;
  dealId?: string | null;
  sopAssist?: string | null;
};

export function buildNewDisposalPath(
  accountSlug: string,
  options?: NewDisposalUrlOptions,
) {
  const path = pathsConfig.app.accountListingNew.replace(
    '[account]',
    accountSlug,
  );
  if (!options) return path;

  const qs = new URLSearchParams();
  if (options.name?.trim()) qs.set('name', options.name.trim());
  if (options.notes?.trim()) qs.set('notes', options.notes.trim());
  if (options.askingRent?.trim())
    qs.set('askingRent', options.askingRent.trim());
  if (options.clientId?.trim()) qs.set('clientId', options.clientId.trim());
  if (options.dealId?.trim()) qs.set('dealId', options.dealId.trim());
  if (options.sopAssist?.trim()) qs.set('sopAssist', options.sopAssist.trim());

  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}
