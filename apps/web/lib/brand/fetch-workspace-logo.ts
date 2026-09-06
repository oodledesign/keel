import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { resolveClientLogoDomain } from '~/lib/clients/client-logo-domain';
import { fetchCompanyLogoBytes } from '~/lib/clients/fetch-company-logo';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { syncWorkspaceLogo } from './sync-workspace-logo';

const AVATARS_BUCKET = 'account_image';

/**
 * Best-effort: pull a logo from the company website and store it as the
 * workspace avatar. Never throws.
 */
export async function maybeFetchWorkspaceLogo(input: {
  accountId: string;
  website?: string | null;
}): Promise<string | null> {
  const domain = resolveClientLogoDomain({
    website: input.website,
    email: null,
  });

  if (!domain) {
    return null;
  }

  try {
    const logo = await fetchCompanyLogoBytes({
      domain,
      website: input.website,
    });
    const admin = getSupabaseServerAdminClient();
    const path = `${input.accountId}/workspace-logo`;
    const { error } = await admin.storage
      .from(AVATARS_BUCKET)
      .upload(path, logo.bytes, {
        contentType: logo.contentType || 'image/png',
        upsert: true,
      });

    if (error) {
      console.info('[onboarding] workspace logo upload skipped', error.message);
      return null;
    }

    const publicUrl = toSupabasePublicStorageUrl(
      admin.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl,
    );

    if (!publicUrl) {
      return null;
    }

    return syncWorkspaceLogo(input.accountId, publicUrl);
  } catch (error) {
    console.info('[onboarding] workspace logo fetch skipped', {
      accountId: input.accountId,
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
