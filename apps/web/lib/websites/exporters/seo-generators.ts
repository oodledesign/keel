/**
 * Prompt E2 — llms.txt + JSON-LD generators.
 *
 * Consumed by every SiteStudioExport pack (Astro / Next / Webflow / prompt).
 * Pure functions over the export contract — no database access.
 *
 * llms.txt follows https://llmstxt.org/ :
 *   H1 (required) → blockquote summary → optional free-form prose (no H2) →
 *   H2 sections of absolute Markdown links `- [name](url): notes` →
 *   optional `## Optional` section for skippable links.
 */
import type {
  ExportPage,
  ExportSeoPage,
  SiteStudioExport,
} from '../export-contract';
import { pageRoute, slugify } from './pack-utils';

export type JsonLdObject = Record<string, unknown>;

export type PageJsonLdBundle = {
  pageSlug: string;
  route: string;
  /** Blocks to emit as separate `<script type="application/ld+json">` tags. */
  blocks: JsonLdObject[];
};

export type GeneratedJsonLd = {
  /** Stable entity @graph shared across the site (org → services → places). */
  siteGraph: JsonLdObject;
  pages: PageJsonLdBundle[];
};

export type SeoGeneratorOptions = {
  /** Edit-before-export override from Search tab (raw Markdown). */
  llmsTxtOverride?: string | null;
};

function siteOrigin(exp: SiteStudioExport): string {
  const raw = exp.website.domain?.trim();
  if (!raw) return 'https://example.com';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

function absoluteUrl(origin: string, route: string): string {
  if (route === '/') return `${origin}/`;
  return `${origin}${route.startsWith('/') ? route : `/${route}`}`;
}

function orgName(exp: SiteStudioExport): string {
  return exp.brief?.org.name?.trim() || exp.website.name || 'Website';
}

function orgId(origin: string): string {
  return `${origin}/#organization`;
}

function serviceId(origin: string, name: string): string {
  return `${origin}/#service/${slugify(name, 'service')}`;
}

function placeId(origin: string, label: string): string {
  return `${origin}/#place/${slugify(label, 'place')}`;
}

function seoForSlug(exp: SiteStudioExport, slug: string): ExportSeoPage | null {
  return exp.seo?.pages.find((page) => page.pageSlug === slug) ?? null;
}

function approvedAnswerBlocks(seo: ExportSeoPage | null) {
  if (!seo || seo.status !== 'approved') return [];
  return seo.aeo.answerBlocks.filter(
    (block) => block.question.trim() && block.draftAnswer.trim(),
  );
}

function primaryNap(exp: SiteStudioExport): string {
  const fromSeo =
    exp.seo?.pages
      .map((page) => page.geo.nap.trim())
      .find((nap) => nap.length > 0) ?? '';
  return fromSeo;
}

function wantsLocalBusiness(exp: SiteStudioExport): boolean {
  if (exp.brief?.org.geography?.trim()) return true;
  return Boolean(
    exp.seo?.pages.some(
      (page) =>
        page.geo.isLocationPage ||
        page.schemaTypes.some((type) => type.toLowerCase() === 'localbusiness'),
    ),
  );
}

/**
 * Draft `/llms.txt` Markdown from brief + sitemap + approved answer blocks.
 * Pass `llmsTxtOverride` to honour Search-tab edit-before-export.
 */
export function generateLlmsTxt(
  exp: SiteStudioExport,
  options?: SeoGeneratorOptions,
): string {
  const override = options?.llmsTxtOverride?.trim();
  if (override) {
    return override.endsWith('\n') ? override : `${override}\n`;
  }

  const origin = siteOrigin(exp);
  const name = orgName(exp);
  const summary =
    exp.brief?.org.oneLiner?.trim() ||
    exp.brief?.offer.services[0]?.description?.trim() ||
    exp.website.name ||
    'Website overview for language models.';

  const lines: string[] = [`# ${name}`, '', `> ${summary}`, ''];

  const factBits: string[] = [];
  if (exp.brief?.offer.services.length) {
    factBits.push(
      `Services: ${exp.brief.offer.services
        .map((service) => service.name)
        .filter(Boolean)
        .join(', ')}.`,
    );
  }
  if (exp.brief?.org.geography?.trim()) {
    factBits.push(`Serving: ${exp.brief.org.geography.trim()}.`);
  }
  const nap = primaryNap(exp);
  if (nap) {
    factBits.push(`Contact / NAP: ${nap}.`);
  }
  if (exp.brief?.offer.primaryConversionGoals.length) {
    factBits.push(
      `Primary goals: ${exp.brief.offer.primaryConversionGoals.join('; ')}.`,
    );
  }

  if (factBits.length) {
    lines.push(...factBits, '');
  }

  const faqs = (exp.seo?.pages ?? []).flatMap((page) =>
    approvedAnswerBlocks(page).map((block) => ({
      pageSlug: page.pageSlug,
      question: block.question.trim(),
      answer: block.draftAnswer.replace(/\s+/g, ' ').trim(),
    })),
  );

  if (faqs.length > 0) {
    lines.push('Common questions (approved answer blocks):');
    const shown = faqs.slice(0, 12);
    for (const faq of shown) {
      lines.push(`- **${faq.question}** ${faq.answer}`);
    }
    if (faqs.length > shown.length) {
      lines.push(
        `_… ${faqs.length - shown.length} more answers omitted — see FAQPage JSON-LD for the full set._`,
      );
    }
    lines.push('');
  }

  lines.push('## Pages', '');
  const pages =
    exp.sitemap.length > 0
      ? exp.sitemap
      : ([
          {
            slug: 'home',
            title: name,
            description: summary,
            pageType: 'home',
            parentId: null,
            status: 'draft',
            sectionIds: [],
          },
        ] satisfies ExportPage[]);

  for (const page of pages) {
    const seo = seoForSlug(exp, page.slug);
    const route = pageRoute(page);
    const url = absoluteUrl(origin, route);
    const description =
      seo?.meta.description?.trim() ||
      page.description?.trim() ||
      `${page.title} page`;
    lines.push(`- [${page.title}](${url}): ${description}`);
  }

  if (exp.brief?.offer.services.length) {
    lines.push('', '## Services', '');
    for (const service of exp.brief.offer.services) {
      const servicePage = pages.find(
        (page) =>
          page.pageType === 'service' ||
          page.slug.includes(slugify(service.name)),
      );
      const url = servicePage
        ? absoluteUrl(origin, pageRoute(servicePage))
        : absoluteUrl(origin, '/');
      const note =
        service.description?.trim() || `${service.name} offered by ${name}`;
      lines.push(`- [${service.name}](${url}): ${note}`);
    }
  }

  const optional: string[] = [];
  if (exp.contentDocs.length) {
    for (const doc of exp.contentDocs) {
      // Skip in-app fragment / placeholder URLs — not navigable on the published site.
      if (!doc.url.startsWith('http')) continue;
      optional.push(`- [${doc.title}](${doc.url}): Editorial content document`);
    }
  }
  optional.push(
    `- [Sitemap](${absoluteUrl(origin, '/sitemap.xml')}): Full URL list`,
  );

  if (optional.length) {
    lines.push('', '## Optional', '');
    lines.push(...optional);
  }

  return `${lines.join('\n')}\n`;
}

function buildSiteGraph(exp: SiteStudioExport): JsonLdObject {
  const origin = siteOrigin(exp);
  const name = orgName(exp);
  const id = orgId(origin);
  const local = wantsLocalBusiness(exp);
  const nap = primaryNap(exp);

  const orgType = local
    ? (['Organization', 'LocalBusiness'] as const)
    : ('Organization' as const);

  const org: JsonLdObject = {
    '@type': orgType,
    '@id': id,
    name,
    url: `${origin}/`,
    description: exp.brief?.org.oneLiner?.trim() || undefined,
    areaServed: exp.brief?.org.geography?.trim() || undefined,
  };

  if (nap) {
    org.address = nap;
  }

  const entities: JsonLdObject[] = [org];

  for (const service of exp.brief?.offer.services ?? []) {
    if (!service.name.trim()) continue;
    entities.push({
      '@type': 'Service',
      '@id': serviceId(origin, service.name),
      name: service.name.trim(),
      description: service.description?.trim() || undefined,
      provider: { '@id': id },
      areaServed: exp.brief?.org.geography?.trim() || undefined,
      url: `${origin}/`,
    });
  }

  const places = new Map<string, string>();
  for (const page of exp.seo?.pages ?? []) {
    if (page.geo.nap.trim()) {
      places.set(page.geo.nap.trim(), page.geo.nap.trim());
    }
    for (const area of page.geo.serviceArea) {
      if (area.trim()) places.set(area.trim(), area.trim());
    }
  }
  if (exp.brief?.org.geography?.trim()) {
    places.set(exp.brief.org.geography.trim(), exp.brief.org.geography.trim());
  }

  for (const [label] of places) {
    entities.push({
      '@type': 'Place',
      '@id': placeId(origin, label),
      name: label,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': entities,
  };
}

function hasSchemaType(seo: ExportSeoPage, type: string): boolean {
  const needle = type.toLowerCase();
  return seo.schemaTypes.some((item) => item.toLowerCase() === needle);
}

function faqPageBlock(
  seo: ExportSeoPage,
  pageUrl: string,
): JsonLdObject | null {
  // FAQ JSON-LD uses approved answer blocks verbatim (acceptance).
  const blocks = approvedAnswerBlocks(seo);
  if (blocks.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    mainEntity: blocks.map((block) => ({
      '@type': 'Question',
      name: block.question.trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: block.draftAnswer.trim(),
      },
    })),
  };
}

function articleBlock(
  seo: ExportSeoPage,
  page: ExportPage,
  pageUrl: string,
  orgRef: string,
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${pageUrl}#article`,
    headline: seo.meta.title || page.title,
    description: seo.meta.description || page.description || undefined,
    url: pageUrl,
    author: { '@id': orgRef },
    publisher: { '@id': orgRef },
  };
}

function howToBlock(
  seo: ExportSeoPage,
  page: ExportPage,
  pageUrl: string,
): JsonLdObject {
  const steps = seo.headingOutline
    .filter((item) => item.level >= 2 && item.text.trim())
    .map((item, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: item.text.trim(),
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${pageUrl}#howto`,
    name: seo.meta.title || page.title,
    description: seo.meta.description || page.description || undefined,
    url: pageUrl,
    step: steps.length
      ? steps
      : [
          {
            '@type': 'HowToStep',
            position: 1,
            name: page.title,
          },
        ],
  };
}

function servicePageBlock(
  exp: SiteStudioExport,
  seo: ExportSeoPage,
  page: ExportPage,
  pageUrl: string,
  origin: string,
): JsonLdObject {
  const serviceName =
    page.title.trim() ||
    exp.brief?.offer.services.find((service) =>
      page.slug.includes(slugify(service.name)),
    )?.name ||
    seo.keywords.primary ||
    'Service';
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name: serviceName,
    description: seo.meta.description || page.description || undefined,
    url: pageUrl,
    provider: { '@id': orgId(origin) },
    areaServed:
      seo.geo.serviceArea[0] || exp.brief?.org.geography?.trim() || undefined,
  };
}

function localBusinessPageBlock(
  exp: SiteStudioExport,
  seo: ExportSeoPage,
  pageUrl: string,
  origin: string,
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${pageUrl}#localbusiness`,
    name: orgName(exp),
    url: pageUrl,
    description: seo.meta.description || exp.brief?.org.oneLiner || undefined,
    address: seo.geo.nap.trim() || primaryNap(exp) || undefined,
    areaServed:
      seo.geo.serviceArea.length > 0
        ? seo.geo.serviceArea
        : exp.brief?.org.geography?.trim() || undefined,
    parentOrganization: { '@id': orgId(origin) },
  };
}

/**
 * Per-page JSON-LD + site-wide entity graph with stable `@id`s.
 * FAQPage `mainEntity` uses approved answer blocks verbatim.
 */
export function generateJsonLd(exp: SiteStudioExport): GeneratedJsonLd {
  const origin = siteOrigin(exp);
  const siteGraph = buildSiteGraph(exp);
  const orgRef = orgId(origin);
  const pages: PageJsonLdBundle[] = [];

  for (const page of exp.sitemap) {
    const seo = seoForSlug(exp, page.slug);
    const route = pageRoute(page);
    const pageUrl = absoluteUrl(origin, route);
    const blocks: JsonLdObject[] = [];

    // Always reference the shared entity graph once per page (site identity).
    blocks.push(siteGraph);

    if (seo) {
      if (hasSchemaType(seo, 'Organization')) {
        // Already in siteGraph — leave pointer via WebPage about
        blocks.push({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${pageUrl}#webpage`,
          url: pageUrl,
          name: seo.meta.title || page.title,
          description: seo.meta.description || page.description || undefined,
          isPartOf: { '@id': orgRef },
          about: { '@id': orgRef },
        });
      }

      if (hasSchemaType(seo, 'Service')) {
        blocks.push(servicePageBlock(exp, seo, page, pageUrl, origin));
      }

      if (hasSchemaType(seo, 'LocalBusiness')) {
        blocks.push(localBusinessPageBlock(exp, seo, pageUrl, origin));
      }

      if (hasSchemaType(seo, 'Article')) {
        blocks.push(articleBlock(seo, page, pageUrl, orgRef));
      }

      if (hasSchemaType(seo, 'HowTo')) {
        blocks.push(howToBlock(seo, page, pageUrl));
      }

      const faq = faqPageBlock(seo, pageUrl);
      if (faq) blocks.push(faq);
    }

    pages.push({ pageSlug: page.slug, route, blocks });
  }

  // Pages with approved FAQ but empty sitemap edge case — still emit if seo-only
  if (pages.length === 0 && exp.seo?.pages.length) {
    for (const seo of exp.seo.pages) {
      const route =
        seo.pageSlug === 'home' || seo.pageSlug === 'index'
          ? '/'
          : `/${seo.pageSlug}`;
      const pageUrl = absoluteUrl(origin, route);
      const blocks: JsonLdObject[] = [siteGraph];
      const faq = faqPageBlock(seo, pageUrl);
      if (faq) blocks.push(faq);
      pages.push({ pageSlug: seo.pageSlug, route, blocks });
    }
  }

  return { siteGraph, pages };
}

/** Serialise blocks as paste-ready HTML script tags. */
export function jsonLdToScriptTags(blocks: JsonLdObject[]): string {
  return blocks
    .map(
      (block) =>
        `<script type="application/ld+json">\n${JSON.stringify(block, null, 2)}\n</script>`,
    )
    .join('\n\n');
}

/** Webflow / docs-friendly Markdown of per-page embeds. */
export function jsonLdEmbedDocument(exp: SiteStudioExport): string {
  const { pages, siteGraph } = generateJsonLd(exp);
  const lines: string[] = [
    `# JSON-LD embed blocks — ${orgName(exp)}`,
    '',
    'Paste each `<script type="application/ld+json">` block into the page `<head>` (or Webflow custom code) for that route.',
    'The site entity `@graph` uses stable `@id`s (`#organization`, `#service/*`, `#place/*`) so pages stay consistent.',
    '',
    '## Site entity graph (include on every page)',
    '',
    '```html',
    jsonLdToScriptTags([siteGraph]),
    '```',
    '',
  ];

  for (const page of pages) {
    lines.push(
      `## ${page.pageSlug} (\`${page.route}\`)`,
      '',
      '```html',
      jsonLdToScriptTags(page.blocks),
      '```',
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}

/** Pack file helpers — shared paths across scaffolds. */
export function seoArtifactFiles(
  exp: SiteStudioExport,
  options?: SeoGeneratorOptions & {
    /** Path for llms.txt (default public/llms.txt). */
    llmsPath?: string;
    /** Include Webflow-style embed doc. */
    includeEmbedDoc?: boolean;
    embedDocPath?: string;
  },
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [
    {
      path: options?.llmsPath ?? 'public/llms.txt',
      content: generateLlmsTxt(exp, options),
    },
  ];

  if (options?.includeEmbedDoc) {
    files.push({
      path: options.embedDocPath ?? 'seo/json-ld-embeds.md',
      content: jsonLdEmbedDocument(exp),
    });
  }

  return files;
}
