import 'server-only';

import { resolveClientLogoDomain } from './client-logo-domain';
import { fetchCompanyLogoBytes } from './fetch-company-logo';
import { storeClientPhotoBytes } from './store-client-photo';

/**
 * Best-effort: resolve a company domain from website/email and store a logo.
 * Never throws — create/update flows should not fail if lookup misses.
 */
export async function maybeAutoFetchClientLogo(input: {
  accountId: string;
  clientId: string;
  website?: string | null;
  email?: string | null;
  existingPictureUrl?: string | null;
}): Promise<string | null> {
  if (input.existingPictureUrl?.trim()) {
    return null;
  }

  const domain = resolveClientLogoDomain({
    website: input.website,
    email: input.email,
  });

  if (!domain) {
    return null;
  }

  try {
    const logo = await fetchCompanyLogoBytes({
      domain,
      website: input.website,
      email: input.email,
    });

    return await storeClientPhotoBytes({
      accountId: input.accountId,
      clientId: input.clientId,
      existingPictureUrl: null,
      bytes: logo.bytes,
      contentType: logo.contentType,
    });
  } catch (error) {
    console.info('[clients] auto logo fetch skipped', {
      clientId: input.clientId,
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
