'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

/**
 * Old in-page anchors that moved in the disposal IA split.
 * `#publishing` / `#publish-options` → Publishing tab.
 * `#agent-contacts` → Management assignment.
 */
export function ListingPublishingHashRedirect({
  publishingHref,
  managementHref,
}: {
  publishingHref: string;
  managementHref?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#publishing' || hash === '#publish-options') {
      router.replace(publishingHref);
      return;
    }
    if (hash === '#agent-contacts' && managementHref) {
      router.replace(`${managementHref}#assignment`);
    }
  }, [managementHref, publishingHref, router]);

  return null;
}
