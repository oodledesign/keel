import 'server-only';

import type { ScorerInput, ScorerOutput } from './types';

function buildScorerPrompt(input: ScorerInput): string {
  const { domain, robotsResult, llmsTxt, sitemap, pages, aiCitations } = input;
  const host = domain.replace(/^www\./, '');

  const homepage =
    pages.find((page) => {
      try {
        const pathname = new URL(page.url).pathname;
        return pathname === '/' || pathname === '';
      } catch {
        return page.url.includes(host);
      }
    }) ?? pages[0];

  const allJsonLdTypes = [
    ...new Set(pages.flatMap((page) => page.jsonLd.map((block) => block.type))),
  ];
  const pagesWithFaq = pages
    .filter((page) => page.faqPatternPresent)
    .map((page) => page.url);
  const pagesWithByline = pages
    .filter((page) => page.bylinePresent)
    .map((page) => page.url);
  const jsRenderedPages = pages
    .filter((page) => page.isJsRendered)
    .map((page) => page.url);

  return `
Produce a complete AI search audit for ${host}. Every recommendation MUST reference
specific evidence below — specific pages, specific missing properties, specific content.
Do not give generic advice not grounded in the data.

---
DOMAIN: ${host}
PAGES CRAWLED: ${pages.length}
${pages.map((page) => `  ${page.url} (${page.wordCount} words, title: "${page.title}")`).join('\n')}

ROBOTS.TXT:
- Present: ${robotsResult.present}
- Wildcard block (Disallow: /): ${robotsResult.wildcardBlocked}
- AI bots BLOCKED: ${robotsResult.blocked.join(', ') || 'none'}
- AI bots ALLOWED: ${robotsResult.allowed.join(', ')}

LLMS.TXT: ${llmsTxt.present ? `Present (${llmsTxt.wordCount ?? 0} words)` : 'NOT PRESENT'}

SITEMAP: ${sitemap.present ? `Present (${sitemap.urlCount} URLs, last updated: ${sitemap.lastmod ?? 'unknown'})` : 'NOT PRESENT'}

JSON-LD SCHEMA TYPES FOUND ACROSS SITE:
${allJsonLdTypes.length ? allJsonLdTypes.join(', ') : 'NONE FOUND'}

HOMEPAGE JSON-LD DETAIL:
${JSON.stringify(homepage?.jsonLd ?? [], null, 2)}

PAGES WITH FAQ PATTERN: ${pagesWithFaq.join(', ') || 'none'}
PAGES WITH BYLINE/AUTHOR: ${pagesWithByline.join(', ') || 'none'}
JS-RENDERED PAGES (content invisible to AI crawlers): ${jsRenderedPages.join(', ') || 'none'}

TITLE TAG AUDIT:
${pages.map((page) => `  ${page.url}: "${page.title}"`).join('\n')}

META DESCRIPTION AUDIT:
${pages
  .map((page) =>
    `  ${page.url}: ${page.metaDesc ? `"${page.metaDesc.slice(0, 80)}…"` : 'MISSING'}`,
  )
  .join('\n')}

OG TAG AUDIT:
${pages
  .map(
    (page) =>
      `  ${page.url}: og:image=${page.ogImage ? 'present' : 'MISSING'}, og:title=${page.ogTitle ? 'present' : 'MISSING'}`,
  )
  .join('\n')}

HEADING STRUCTURE (homepage):
H1s: ${homepage?.h1s.join(' | ') || 'none'}
H2s: ${homepage?.h2s.slice(0, 10).join(' | ') || 'none'}

CONTENT SIGNALS:
${pages
  .map(
    (page) =>
      `  ${page.url}: tables=${page.tableCount}, hasTldr=${page.hasTldr}, lastUpdatedVisible=${page.lastUpdatedVisible}`,
  )
  .join('\n')}

AI CITATIONS BY PLATFORM (DataForSEO live checks):
${aiCitations.platforms
  .map(
    (platform) =>
      `${platform.label}:
${platform.citations
  .map(
    (citation) =>
      `    "${citation.query}": triggered=${citation.triggered}, domain cited=${citation.domainCited}${citation.citedUrls.length ? `, urls=${citation.citedUrls.slice(0, 3).join('; ')}` : ''}`,
  )
  .join('\n')}`,
  )
  .join('\n\n')}
Competing brands cited instead: ${aiCitations.competingBrands.join(', ') || 'none detected'}

---
Score each dimension 0–100 based strictly on the evidence above.
Scoring guidance:
- 80–100: Strong — most signals present, minor gaps
- 60–79: Moderate — key signals present but important gaps
- 40–59: Weak — significant gaps affecting AI discoverability
- 0–39: Critical — fundamental signals missing

Then produce a prioritised recommendation list. Rules:
- Each recommendation must name a specific page URL from the crawl as example_urls
- "outcome" = what LLMs will do differently as a result (one sentence)
- "why" = the technical reason this helps AI parsing (one sentence)
- "magnitude" = one of: "Critical for...", "Significant for...", "High for...", "Moderate for..."
- is_quick_win = true if implementable in under 30 minutes (schema addition, title fix, meta update)
- Include 5–8 HIGH priority, 8–12 MEDIUM, 5–8 LOW
- HIGH = directly blocks or significantly impairs AI citation
- MEDIUM = improves citation reliability and topical authority
- LOW = incremental improvements, future-proofing

Return this exact JSON shape:

{
  "score_entity": 74,
  "score_content": 67,
  "score_eeat": 74,
  "score_tech": 40,
  "overall_score": 64,
  "executive_summary": "2–3 sentence summary suitable for a client report",
  "recommendations": [
    {
      "dimension": "entity",
      "priority": "high",
      "is_quick_win": false,
      "title": "Implement Organization Schema with knowsAbout properties",
      "description": "Add JSON-LD to the homepage defining the organisation.",
      "outcome": "LLMs will associate the brand with its specialist areas.",
      "why": "Explicit schema triples remove the need for LLMs to infer authority from prose.",
      "magnitude": "Significant for brand-authority queries and industry-specific discovery.",
      "example_urls": ["https://example.com"]
    }
  ]
}
`;
}

async function callClaude(prompt: string, retry = false): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.ANTHROPIC_AUDIT_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    'claude-sonnet-4-20250514';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      system: retry
        ? 'Output only valid JSON. No markdown. No preamble. Start with {'
        : `You are an expert in AI search optimisation (AEO/GEO). You analyse website evidence and produce scored audit reports with specific, actionable recommendations.
Every recommendation must reference actual evidence from the domain — specific pages, specific missing schema types, specific title tag content. Never give generic advice.
Output only valid JSON. No markdown fences. No preamble. Start with {`,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  return data.content?.find((block) => block.type === 'text')?.text ?? '{}';
}

function parseScorerJson(text: string): ScorerOutput {
  const cleaned = text
    .trim()
    .replace(/^```json\n?/i, '')
    .replace(/\n?```$/i, '');
  return JSON.parse(cleaned) as ScorerOutput;
}

export async function scoreAndRecommend(
  input: ScorerInput,
): Promise<ScorerOutput> {
  const prompt = buildScorerPrompt(input);

  try {
    const text = await callClaude(prompt);
    return parseScorerJson(text);
  } catch {
    const retryText = await callClaude(prompt, true);
    return parseScorerJson(retryText);
  }
}

export async function generateFixSnippet(input: {
  title: string;
  description: string;
  exampleUrl: string;
  dimension: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.ANTHROPIC_AUDIT_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    'claude-sonnet-4-20250514';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      system:
        'You produce specific, copy-paste-ready fixes for AI search optimisation issues. Output the fix only — no explanation, no preamble.',
      messages: [
        {
          role: 'user',
          content: `Produce a specific, copy-paste-ready fix for this recommendation:

Title: ${input.title}
Description: ${input.description}
Example page: ${input.exampleUrl}
Dimension: ${input.dimension}

If the fix is JSON-LD schema, output a complete <script type="application/ld+json"> block.
If it's a title tag fix, output the corrected <title> tag.
If it's a content addition, output the HTML to add.
If it's a robots.txt fix, output the specific lines to add/remove.
Keep it minimal and precise.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status})`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  return data.content?.find((block) => block.type === 'text')?.text ?? '';
}
