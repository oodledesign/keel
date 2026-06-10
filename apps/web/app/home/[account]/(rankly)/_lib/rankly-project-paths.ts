import pathsConfig from '~/config/paths.config';

export type RanklyProjectPaths = {
  dashboard: string;
  keywords: string;
  siteExplorer: string;
  siteCrawler: string;
  pages: string;
  pagespeed: string;
  aiAudit: string;
  briefs: string;
  clusters: string;
};

export function ranklyPagesDetailPath(
  account: string,
  projectId: string,
  pageKey: string,
) {
  return pathsConfig.app.accountRanklyProjectPagesDetail
    .replace('[account]', account)
    .replace('[projectId]', projectId)
    .replace('[pageKey]', pageKey);
}

export function ranklyPagespeedPagePath(
  account: string,
  projectId: string,
  pageId: string,
) {
  return pathsConfig.app.accountRanklyProjectPagespeedPage
    .replace('[account]', account)
    .replace('[projectId]', projectId)
    .replace('[pageId]', pageId);
}

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
    siteCrawler: replace(pathsConfig.app.accountRanklyProjectSiteCrawler),
    pages: replace(pathsConfig.app.accountRanklyProjectPages),
    pagespeed: replace(pathsConfig.app.accountRanklyProjectPagespeed),
    aiAudit: replace(pathsConfig.app.accountRanklyProjectAiAudit),
    briefs: replace(pathsConfig.app.accountRanklyProjectBriefs),
    clusters: replace(pathsConfig.app.accountRanklyProjectClusters),
  };
}
