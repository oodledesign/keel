import pathsConfig from '~/config/paths.config';

export type ListingPreviewExternalLink = {
  label: string;
  href: string;
};

/** Build share/portal links for the preview banner (desk-only helpers). */
function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildListingPreviewExternalLinks(input: {
  brochureShareEnabled: boolean;
  brochureShareToken: string | null;
  websiteUrl: string | null;
  publications: Array<{
    portal: string;
    status: string;
    externalUrl: string | null;
  }>;
}): ListingPreviewExternalLink[] {
  const links: ListingPreviewExternalLink[] = [];

  if (input.brochureShareEnabled && input.brochureShareToken) {
    links.push({
      label: 'Open brochure share',
      href: pathsConfig.app.brochureShare.replace(
        '[token]',
        input.brochureShareToken,
      ),
    });
  }

  const websiteUrl = input.websiteUrl?.trim() ?? '';
  if (websiteUrl && isSafeHttpUrl(websiteUrl)) {
    links.push({
      label: 'Open website',
      href: websiteUrl,
    });
  }

  for (const publication of input.publications) {
    const externalUrl = publication.externalUrl?.trim() ?? '';
    if (
      externalUrl &&
      isSafeHttpUrl(externalUrl) &&
      (publication.status === 'published' || publication.status === 'live')
    ) {
      const portal =
        publication.portal.charAt(0).toUpperCase() +
        publication.portal.slice(1);
      links.push({
        label: `Open ${portal}`,
        href: externalUrl,
      });
    }
  }

  return links;
}
