/** Default content and asset URLs from the YBB Astro site (editable in Puck). */

/** YBB Design tab mapping: primary #CC848A, N2 (atmosphere) #F9DADA, buttons pill. */
export const YBB_DEFAULTS = {
  heroVideoUrl:
    'https://vz-e8a4ebea-688.b-cdn.net/d3fca904-7a68-421f-9341-e6e7541d75d1/play_720p.mp4',
  heroVideoAlt: 'Your Bridal Besties wedding morning video',
  /** Bundled in apps/web/public/workspace-assets/ybb/ — upload via Site media to override. */
  logoUrl: '/workspace-assets/ybb/hero-logo.svg',
  logoWideUrl: '/workspace-assets/ybb/logo-wide.svg',
  monogramUrl: '/workspace-assets/ybb/monogram.svg',
  logoNavUrl: '/workspace-assets/ybb/logo-nav.svg',
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
  announcementHeading: '2028 bookings open in October',
  announcementSubtext: 'Join our waitlist now',
  announcementEmailPlaceholder: 'Your email address',
  announcementButtonLabel: 'Waitlist me',
  announcementFormAction: 'mailto:BOOKINGS@YOURBRIDALBESTIES.CO.UK',
  navCtaLabel: 'Enquire',
  navCtaHref: 'mailto:BOOKINGS@YOURBRIDALBESTIES.CO.UK',
  scallopScriptLine: "Let's do this!",
  scallopHeadingHtml:
    "We're the girlies you actually want around on your wedding morning",
  scallopBody:
    "The ones who'll calm your nerves, hype you up, and sneak you a sip of Prosecco before 10am. Luxe, soft glam that still feels like you, done by people who feel like friends.",
  scallopBandColor: '#800000',
  scallopBottomFillColor: '#F9DADA',
  glamGirlsTitle: "We're not just your glam squad.\nWe're your girls.",
  glamGirlsKicker: "Here's why brides choose us as their besties",
  foundersTitle: 'Meet Zoe and Eloise',
  foundersBody:
    "Two best friends, one shared obsession with making brides feel incredible. We've been inseparable since the day we met — and your wedding morning is better for it.",
  foundersCtaLabel: 'Meet the Besties',
  foundersCtaHref: '#about',
  foundersPhotoUrl: '',
  foundersStarOuterUrl: '/workspace-assets/ybb/founders/star-outer.svg',
  foundersStarInnerUrl: '/workspace-assets/ybb/founders/star-inner.svg',
  foundersStarMaskUrl: '/workspace-assets/ybb/founders/star-mask.svg',
  portfolioTitle: 'Some of our previous beautiful clients',
  portfolioCtaLabel: 'Enquire now',
  portfolioCtaHref: 'mailto:BOOKINGS@YOURBRIDALBESTIES.CO.UK',
} as const;

export const YBB_DEFAULT_PORTFOLIO_TILTS = [
  '3.9',
  '-4.36',
  '3.32',
  '-2.83',
  '2.1',
  '-3.5',
  '1.8',
  '-2.2',
  '4',
  '-1.5',
  '2.8',
  '-3.1',
] as const;

export type YbbGlamCardSlot =
  | 'leftPolaroid'
  | 'leftSpeech'
  | 'centerPolaroid'
  | 'rightSpeech'
  | 'rightPolaroid';

export const YBB_DEFAULT_GLAM_CARDS = [
  {
    slot: 'leftPolaroid' as const,
    title: 'A Room Full of Besties',
    body: "We're real-life besties whose effortless teamwork turns bridal prep into a relaxed, morning pre drink— no stress-o just prosecco!",
    imageUrl: '',
    imageAlt: 'Bridal party getting ready together',
    ctaLabel: 'Meet the Besties',
    ctaHref: '#team',
    ctaColor: 'green' as const,
    tilt: '-2.5',
    featured: false,
    squarePhoto: true,
  },
  {
    slot: 'leftSpeech' as const,
    title: "We're your Wedding Day Sidekicks",
    body: "From helping you into your dress to calming your 'OMG is this really happening' nerves—we've got your back (and your veil).",
    imageUrl: '',
    imageAlt: 'Zoe',
    linkLabel: 'Learn more →',
    linkHref: '#about',
  },
  {
    slot: 'centerPolaroid' as const,
    title: 'Pampered Bride from prep to last dance',
    body: "A well-oiled schedule, touch-ups on tap, and social-media-ready moments—because 'Insta-Bride' status is non-negotiable",
    imageUrl: '',
    imageAlt: 'Bride with soft glam makeup',
    ctaLabel: 'Learn more',
    ctaHref: '#about',
    ctaColor: 'rose' as const,
    tilt: '3.2',
    featured: true,
    squarePhoto: false,
  },
  {
    slot: 'rightSpeech' as const,
    title: 'Babes, We Know What You Need Before You Do',
    body: 'Music on, temperature just right, quiet when it counts—we read the room so you can breathe easy and glow effortlessly.',
    imageUrl: '',
    imageAlt: 'Eloise',
    linkLabel: 'Learn more →',
    linkHref: '#about',
  },
  {
    slot: 'rightPolaroid' as const,
    title: 'We love, love!',
    body: 'We bring your unique romance to life in every look, making sure your makeup and hair feel as personal as your vows.',
    imageUrl: '',
    imageAlt: 'Bride on her wedding day',
    ctaLabel: 'Enquire now',
    ctaHref: 'mailto:BOOKINGS@YOURBRIDALBESTIES.CO.UK',
    ctaColor: 'cress' as const,
    tilt: '-1.8',
    featured: false,
    squarePhoto: true,
  },
];
