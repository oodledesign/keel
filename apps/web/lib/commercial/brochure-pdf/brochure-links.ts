export type BrochureLinkButton = {
  id: 'website' | 'slideshow';
  label: string;
  url: string;
};

function isPublicHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '169.254.169.254' ||
      host.startsWith('169.254.') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Cover/contact CTA buttons. Defaults are on; a missing URL hides that button.
 */
export function resolveBrochureLinkButtons(input: {
  showWebsiteListingButton?: boolean;
  showSlideshowBrochureButton?: boolean;
  websiteListingUrl?: string | null;
  slideshowBrochureUrl?: string | null;
}): BrochureLinkButton[] {
  const showWebsite = input.showWebsiteListingButton !== false;
  const showSlideshow = input.showSlideshowBrochureButton !== false;
  const buttons: BrochureLinkButton[] = [];

  const website = input.websiteListingUrl?.trim() ?? '';
  if (showWebsite && isPublicHttpUrl(website)) {
    buttons.push({
      id: 'website',
      label: 'Website listing',
      url: website,
    });
  }

  const slideshow = input.slideshowBrochureUrl?.trim() ?? '';
  if (showSlideshow && isPublicHttpUrl(slideshow)) {
    buttons.push({
      id: 'slideshow',
      label: 'Online brochure',
      url: slideshow,
    });
  }

  return buttons;
}
