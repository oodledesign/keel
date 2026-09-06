import { getSafeRedirectPath } from '@kit/shared/utils';

import pathsConfig from '~/config/paths.config';
import {
  type SetupIntent,
  parseSetupIntent,
} from '~/lib/billing/pricing-marketing';

export function isWorkspaceSetupPath(path: string) {
  return (
    path === pathsConfig.app.workspaceSetup ||
    path.startsWith(`${pathsConfig.app.workspaceSetup}?`)
  );
}

export function isBusinessOnboardingPath(path: string) {
  return (
    path === pathsConfig.app.businessOnboarding ||
    path.startsWith(`${pathsConfig.app.businessOnboarding}?`)
  );
}

export function isSetupPath(path: string) {
  return isWorkspaceSetupPath(path) || isBusinessOnboardingPath(path);
}

/** Map marketing `intent=` hints to a post-auth path when `next` is omitted. */
export function resolveSignupNext(next?: string, intent?: string) {
  if (next?.trim()) return next;
  if (intent === 'business') return pathsConfig.app.businessOnboarding;
  return next;
}

/** Resolve workspace / business onboarding intent from the post-auth `next` path. */
export function parseIntentFromNext(
  next: string | undefined,
): SetupIntent | null {
  if (!next?.trim()) return null;

  const path = getSafeRedirectPath(next, pathsConfig.app.home);
  if (!isSetupPath(path)) return null;

  const url = new URL(path, 'http://ozer.local');
  const intent = parseSetupIntent(url.searchParams);

  // Direct /setup/business (no plan query) still means business onboarding.
  if (
    isBusinessOnboardingPath(path) &&
    !intent.profile &&
    !intent.productId &&
    !intent.planId
  ) {
    return { ...intent, profile: 'work_design' };
  }

  return intent;
}
