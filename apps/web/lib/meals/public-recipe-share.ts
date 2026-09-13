import { getAppSiteOrigin } from '~/lib/app-host-routing';

export function buildPublicRecipeSharePath(token: string) {
  return `/share/recipe/${token}`;
}

export function buildPublicRecipeBookSharePath(token: string) {
  return `/share/recipe-book/${token}`;
}

export function buildPublicRecipeShareUrl(token: string, origin?: string) {
  const base = (origin ?? getAppSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildPublicRecipeSharePath(token)}`;
}

export function buildPublicRecipeBookShareUrl(token: string, origin?: string) {
  const base = (origin ?? getAppSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildPublicRecipeBookSharePath(token)}`;
}

export function isUsableShareToken(
  token: string | null | undefined,
): token is string {
  return Boolean(token && token.length >= 16);
}
