import pathsConfig from '~/config/paths.config';

export type BrainChatUrlParams = {
  jobId?: string;
  clientId?: string;
  jobTitle?: string;
  clientName?: string;
  q?: string;
};

export function buildBrainChatUrl(
  accountSlug: string,
  params?: BrainChatUrlParams,
) {
  const path = pathsConfig.app.accountBrain.replace('[account]', accountSlug);
  if (!params) return path;

  const search = new URLSearchParams();
  if (params.jobId) search.set('jobId', params.jobId);
  if (params.clientId) search.set('clientId', params.clientId);
  if (params.jobTitle) search.set('jobTitle', params.jobTitle);
  if (params.clientName) search.set('clientName', params.clientName);
  if (params.q) search.set('q', params.q);

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
