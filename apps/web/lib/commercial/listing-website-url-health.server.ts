import 'server-only';

import { unstable_cache } from 'next/cache';

import {
  type WebsiteUrlHealth,
  isSafePublicProbeUrl,
  probePublicListingPageUrl,
} from '~/lib/commercial/listing-website-url-health';

const HEALTH_REVALIDATE_SECONDS = 120;

export async function getCachedWebsiteUrlHealth(
  url: string,
): Promise<WebsiteUrlHealth> {
  if (!isSafePublicProbeUrl(url)) {
    return {
      url,
      ok: false,
      status: null,
      reason: 'unsafe_url',
    };
  }

  return unstable_cache(
    async () => probePublicListingPageUrl(url),
    ['website-url-health', url],
    { revalidate: HEALTH_REVALIDATE_SECONDS },
  )();
}
