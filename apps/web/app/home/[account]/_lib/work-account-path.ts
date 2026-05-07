import pathsConfig from '~/config/paths.config';

/** Public workspace URL segment `/app/work/:slug/...` from a paths template containing `[account]`. */
export function workAccountPath(pathTemplate: string, accountSlug: string) {
  return pathTemplate.replace('[account]', accountSlug);
}

export const workPaths = pathsConfig.app;
