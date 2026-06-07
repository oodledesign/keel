import pathsConfig from '~/config/paths.config';

export type RanklyProjectPaths = {
  dashboard: string;
  keywords: string;
  siteExplorer: string;
  pagespeed: string;
  aiAudit: string;
  briefs: string;
  clusters: string;
};

export function ranklyProjectPaths(
  account: string,
  projectId: string,
): RanklyProjectPaths {
  const replace = (template: string) =>
    template.replace('[account]', account).replace('[projectId]', projectId);

  return {
    dashboard: replace(pathsConfig.app.accountRanklyProjectDetail),
    keywords: replace(pathsConfig.app.accountRanklyProjectKeywords),
    siteExplorer: replace(pathsConfig.app.accountRanklyProjectSiteExplorer),
    pagespeed: replace(pathsConfig.app.accountRanklyProjectPagespeed),
    aiAudit: replace(pathsConfig.app.accountRanklyProjectAiAudit),
    briefs: replace(pathsConfig.app.accountRanklyProjectBriefs),
    clusters: replace(pathsConfig.app.accountRanklyProjectClusters),
  };
}
