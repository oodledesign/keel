import 'server-only';

import { z } from 'zod';

export {
  LINKEDIN_API_VERSION,
  LINKEDIN_REST_BASE,
  MAX_LINKEDIN_IMAGES,
} from '~/lib/commercial/linkedin-publishing/constants';

export type LinkedInAppConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getOptionalLinkedInApp(): LinkedInAppConfig | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI?.trim() || defaultLinkedInRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  if (!z.string().url().safeParse(redirectUri).success) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function isLinkedInAppConfigured(): boolean {
  return getOptionalLinkedInApp() !== null;
}

function defaultLinkedInRedirectUri(): string | null {
  const origin =
    process.env.NEXT_PUBLIC_APP_SITE_URL?.replace(/\/+$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (!origin) return null;
  return `${origin}/api/linkedin-org/auth/callback`;
}

export function linkedInOAuthScopes(): string {
  return [
    'openid',
    'profile',
    'email',
    'w_organization_social',
    'r_organization_social',
  ].join(' ');
}
