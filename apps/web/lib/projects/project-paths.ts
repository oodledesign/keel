import pathsConfig from '~/config/paths.config';

export type ProjectsUiVariant = 'projects' | 'maintenance' | 'simple';

/** Sentinel slug for personal-home project routes (mirrors notes). */
export const PERSONAL_PROJECTS_ACCOUNT_SLUG = 'personal';

export function isPersonalProjectsScope(
  accountSlug: string,
  personalScope?: boolean,
) {
  return (
    personalScope === true || accountSlug === PERSONAL_PROJECTS_ACCOUNT_SLUG
  );
}

export function projectListHref(accountSlug: string, personalScope?: boolean) {
  if (isPersonalProjectsScope(accountSlug, personalScope)) {
    return pathsConfig.app.personalProjects;
  }

  return pathsConfig.app.accountProjects.replace('[account]', accountSlug);
}

export function projectDetailHref(
  accountSlug: string,
  projectId: string,
  personalScope?: boolean,
) {
  if (isPersonalProjectsScope(accountSlug, personalScope)) {
    return pathsConfig.app.personalProjectDetail.replace('[id]', projectId);
  }

  return pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', projectId);
}

export function projectPhaseHref(
  accountSlug: string,
  projectId: string,
  phaseId: string,
  personalScope?: boolean,
) {
  if (isPersonalProjectsScope(accountSlug, personalScope)) {
    return pathsConfig.app.personalProjectPhaseDetail
      .replace('[id]', projectId)
      .replace('[phaseId]', phaseId);
  }

  return pathsConfig.app.accountJobPhaseDetail
    .replace('[account]', accountSlug)
    .replace('[id]', projectId)
    .replace('[phaseId]', phaseId);
}
