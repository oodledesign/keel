/**
 * Typed JSON-LD builders for the Ozer marketing site.
 * Render with <JsonLd data={...} /> — never hand-paste script tags.
 */
import { brandAssets } from '~/config/brand.config';
import { getMarketingSiteOrigin } from '~/lib/app-host-routing';

export type JsonLd = Record<string, unknown>;

const SITE_URL = () => getMarketingSiteOrigin().replace(/\/$/, '');

export function absoluteUrl(path = '/'): string {
  const base = SITE_URL();
  if (!path || path === '/') return `${base}/`;
  return path.startsWith('http')
    ? path
    : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function organizationJsonLd(): JsonLd {
  const sameAs: string[] = [
    // Add public profiles when live (LinkedIn, X, etc.).
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ozer',
    legalName: 'Oodle Designs Ltd',
    url: absoluteUrl('/'),
    logo: absoluteUrl(brandAssets.icon),
    description:
      'Ozer is the Workspace OS for freelancers and small agencies — personal, business, property, and community in one account.',
    foundingLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'GB',
      },
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export type SoftwareOfferInput = {
  name: string;
  price: number;
  priceCurrency?: string;
  description?: string;
  url?: string;
};

export function softwareApplicationJsonLd(input: {
  name: string;
  description: string;
  url: string;
  offers: SoftwareOfferInput[];
  operatingSystem?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: input.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: input.operatingSystem ?? 'Web, macOS',
    description: input.description,
    url: input.url,
    offers: input.offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      price: offer.price,
      priceCurrency: offer.priceCurrency ?? 'GBP',
      description: offer.description,
      url: offer.url ?? input.url,
    })),
    provider: {
      '@type': 'Organization',
      name: 'Ozer',
      url: absoluteUrl('/'),
    },
  };
}

export type FaqEntry = {
  question: string;
  answer: string;
};

export function faqPageJsonLd(faqs: FaqEntry[]): JsonLd | null {
  if (faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: {
      '@type': 'WebSite',
      name: 'Ozer',
      url: absoluteUrl('/'),
    },
  };
}

export function articleJsonLd(input: {
  headline: string;
  description?: string;
  path: string;
  datePublished?: string | null;
  dateModified?: string | null;
  imageUrl?: string | null;
  authorName?: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(input.path),
    author: {
      '@type': 'Person',
      name: input.authorName ?? 'Dan Potter',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ozer',
      url: absoluteUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(brandAssets.icon),
      },
    },
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.imageUrl
      ? {
          image: {
            '@type': 'ImageObject',
            url: input.imageUrl.startsWith('http')
              ? input.imageUrl
              : absoluteUrl(input.imageUrl),
          },
        }
      : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(input.path),
    },
  };
}

export function blogJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Ozer Blog',
    url: absoluteUrl('/blog'),
    description:
      'Notes from the studio on running freelance work and the Workspace OS.',
    publisher: {
      '@type': 'Organization',
      name: 'Ozer',
      url: absoluteUrl('/'),
    },
  };
}

/** Merge graphs into a single JSON-LD payload (array or one object). */
export function schemaGraph(
  nodes: Array<JsonLd | null | undefined>,
): JsonLd | JsonLd[] {
  const list = nodes.filter((n): n is JsonLd => Boolean(n));
  if (list.length === 1) return list[0]!;
  return list;
}

export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data);
}
