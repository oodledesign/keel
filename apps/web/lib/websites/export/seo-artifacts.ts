import type { WebsiteExportFile, WebsiteExportInput } from './types';
import { pageRoute } from './types';

/** Draft llms.txt (llmstxt.org convention) from brief + sitemap + answer blocks. */
export function buildLlmsTxt(input: WebsiteExportInput): WebsiteExportFile {
  const { brief, sitemap } = input;
  const origin = input.domain ? `https://${input.domain.replace(/^https?:\/\//, '')}` : '';

  const lines: string[] = [
    `# ${brief?.orgName || input.websiteName}`,
    '',
    `> ${brief?.brandSummary || brief?.offer || 'Website summary.'}`,
    '',
  ];

  if (brief?.offer) {
    lines.push(brief.offer, '');
  }
  if (brief?.geography) {
    lines.push(`Serving: ${brief.geography}`, '');
  }

  lines.push('## Pages', '');
  for (const page of sitemap) {
    const url = `${origin}${pageRoute(page)}`;
    const description =
      page.seoIntent || page.description || `${page.title} page`;
    lines.push(`- [${page.title}](${url}): ${description}`);
  }

  const faqs = sitemap.flatMap((page) => {
    const seo = input.seoPages[page.id];
    return (seo?.answerBlocks ?? []).map((block) => ({ page, block }));
  });

  if (faqs.length > 0) {
    lines.push('', '## Common questions', '');
    for (const { block } of faqs.slice(0, 12)) {
      lines.push(`- **${block.question}** ${block.answer.replace(/\n+/g, ' ')}`);
    }
  }

  return {
    path: 'public/llms.txt',
    language: 'markdown',
    content: lines.join('\n') + '\n',
  };
}

/** JSON-LD blocks: Organization/LocalBusiness + FAQPage per page with answer blocks. */
export function buildJsonLd(input: WebsiteExportInput): WebsiteExportFile {
  const { brief } = input;
  const origin = input.domain
    ? `https://${input.domain.replace(/^https?:\/\//, '')}`
    : 'https://example.com';

  const blocks: Array<Record<string, unknown>> = [];

  const isLocal = Boolean(brief?.geography?.trim());
  blocks.push({
    '@context': 'https://schema.org',
    '@type': isLocal ? 'LocalBusiness' : 'Organization',
    name: brief?.orgName || input.websiteName,
    url: origin,
    description: brief?.brandSummary || undefined,
    areaServed: brief?.geography || undefined,
  });

  for (const page of input.sitemap) {
    const seo = input.seoPages[page.id];
    if (!seo || seo.answerBlocks.length === 0) continue;

    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: `${origin}${pageRoute(page)}`,
      mainEntity: seo.answerBlocks.map((block) => ({
        '@type': 'Question',
        name: block.question,
        acceptedAnswer: { '@type': 'Answer', text: block.answer },
      })),
    });
  }

  const scripts = blocks
    .map(
      (block) =>
        `<script type="application/ld+json">\n${JSON.stringify(block, null, 2)}\n</script>`,
    )
    .join('\n\n');

  return {
    path: 'seo/json-ld.html',
    language: 'html',
    content: `<!-- JSON-LD blocks — paste into <head> per page (FAQPage blocks belong on their page) -->\n\n${scripts}\n`,
  };
}

/** Human-readable per-page SEO plan. */
export function buildSeoPlan(input: WebsiteExportInput): WebsiteExportFile {
  const lines: string[] = [
    `# Search readiness plan — ${input.websiteName}`,
    '',
    'Per-page SEO / GEO / AEO fields approved in Site Studio.',
    '',
  ];

  for (const page of input.sitemap) {
    const seo = input.seoPages[page.id];
    lines.push(`## ${page.title} (${pageRoute(page)})`, '');
    if (!seo) {
      lines.push('_No SEO fields yet — generate them in the Search tab._', '');
      continue;
    }
    lines.push(
      `- Primary keyword: ${seo.primaryKeyword || '—'}`,
      `- Secondary: ${seo.secondaryKeywords || '—'}`,
      `- Title: ${seo.title || '—'}`,
      `- Meta description: ${seo.metaDescription || '—'}`,
      `- H1: ${seo.h1 || '—'}`,
      `- Schema types: ${seo.schemaTypes.join(', ') || '—'}`,
    );
    if (seo.headingOutline) {
      lines.push('', '### Heading outline', '', '```', seo.headingOutline, '```');
    }
    if (seo.localSeo) {
      lines.push('', `### Local SEO`, '', seo.localSeo);
    }
    if (seo.answerBlocks.length > 0) {
      lines.push('', '### Answer blocks (AEO)', '');
      for (const block of seo.answerBlocks) {
        lines.push(`- **${block.question}**`, `  ${block.answer}`, '');
      }
    }
    if (seo.internalLinks) {
      lines.push('', '### Internal links', '', seo.internalLinks);
    }
    lines.push('');
  }

  return {
    path: 'seo/seo-plan.md',
    language: 'markdown',
    content: lines.join('\n'),
  };
}
