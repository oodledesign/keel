/** Default content and asset URLs from the YBB Astro site (editable in Puck). */

/** YBB Design tab mapping: primary #CC848A, N2 (atmosphere) #F9DADA, buttons pill. */
export const YBB_DEFAULTS = {
  heroVideoUrl:
    'https://vz-e8a4ebea-688.b-cdn.net/d3fca904-7a68-421f-9341-e6e7541d75d1/play_720p.mp4',
  heroVideoAlt: 'Your Bridal Besties wedding morning video',
  /** Bundled in apps/web/public/workspace-assets/ybb/ — upload via Site media to override. */
  logoUrl: '/workspace-assets/ybb/hero-logo.svg',
  logoWideUrl: '/workspace-assets/ybb/logo-wide.svg',
  monogramUrl: '/workspace-assets/ybb/hero-logo.svg',
  /** Upload a floral texture in Puck when ready — production YBB asset not bundled yet. */
  heroTextureUrl: '',
  footerTextureUrl:
    'https://yourbridalbesties.co.uk/assets/images/branding/ybb_wallpaper-icons-pink-2.png',
  footerCutoutUrl:
    'https://yourbridalbesties.co.uk/assets/images/photos/footer-cutout.png',
  tagline: 'With a brush in one hand and a prosecco for you in the other!',
  primaryCtaLabel: 'Enquire now',
  primaryCtaHref: 'mailto:BOOKINGS@YOURBRIDALBESTIES.CO.UK',
  secondaryCtaLabel: 'Meet the Besties',
  secondaryCtaHref: '#team',
  pressHeading:
    'The good stuff — awards, features & the brands we trust on your big day',
  email: 'BOOKINGS@YOURBRIDALBESTIES.CO.UK',
  socialHandle: '@YOURBRIDALBESTIESUK',
  instagramUrl: 'https://instagram.com/YOURBRIDALBESTIESUK',
  tiktokUrl: 'https://www.tiktok.com/@YOURBRIDALBESTIESUK',
  copyrightTagline: 'Where glam meets girl gang.',
} as const;
