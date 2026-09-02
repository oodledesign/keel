export type BrochureLinkButton = {
  id: 'website' | 'slideshow';
  label: string;
  url: string;
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
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
  if (showWebsite && isHttpUrl(website)) {
    buttons.push({
      id: 'website',
      label: 'Website listing',
      url: website,
    });
  }

  const slideshow = input.slideshowBrochureUrl?.trim() ?? '';
  if (showSlideshow && isHttpUrl(slideshow)) {
    buttons.push({
      id: 'slideshow',
      label: 'Online brochure',
      url: slideshow,
    });
  }

  return buttons;
}
