import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

import type { BriefOutput, BriefSynthesisInput } from './types';

function buildPrompt(input: BriefSynthesisInput): string {
  return `
Produce a complete content brief. Base every recommendation on the data below.

TARGET DOMAIN: ${input.targetDomain}
TARGET KEYWORD: ${input.targetKeyword}
COUNTRY: ${input.country}
BRIEF TEMPLATE: ${input.template} (${input.templateRationale})

---
DOMAIN — EXISTING TOP KEYWORDS (for gap awareness + internal links):
${input.domainKeywords
  .slice(0, 30)
  .map((k) => `${k.keyword} (pos ${k.rank}, ${k.volume}/mo)`)
  .join('\n')}

TOP 5 COMPETITORS:
${input.competitors
  .map(
    (c) =>
      `- ${c.domain} (OPR: ${c.opr}/10, Referring domains: ${c.referring_domains ?? 'unknown'})`,
  )
  .join('\n')}

TARGET DOMAIN:
- ${input.targetDomain} (OPR: ${input.targetOpr}/10, Referring domains: ${input.targetReferringDomains ?? 'unknown'})

KEYWORD GAP OPPORTUNITIES (informational, vol >1k, KD <40):
${input.keywordGaps
  .slice(0, 15)
  .map((k) => `${k.keyword} (${k.volume}/mo, KD ${k.kd})`)
  .join('\n')}

---
SERP TOP 10 FOR "${input.targetKeyword}":
${input.serpResults.map((r, i) => `${i + 1}. [${r.title}](${r.url})`).join('\n')}

SERP FEATURES: ${input.serpFeatures.join(', ') || 'none'}

AI OVERVIEW CITED BRANDS: ${input.aiCitedBrands.join(', ') || 'not triggered'}

---
TOP 3 COMPETITOR PAGES SCRAPED:
${input.competitorPages
  .map(
    (c, i) => `
Page ${i + 1}: ${c.url}
Title: ${c.title} (${c.title.length} chars)
Word count: ~${c.wordCount}
H1: ${c.h1s[0] ?? 'none'}
H2s: ${c.h2s.slice(0, 8).join(' | ')}
JSON-LD types: ${c.jsonLdTypes.join(', ') || 'none'}
Byline: ${c.bylinePresent ? 'yes' : 'no'} | og:image: ${c.ogImage ? 'yes' : 'no'}
`,
  )
  .join('\n')}

RELATED KEYWORDS: ${input.relatedKeywords
  .slice(0, 20)
  .map((k) => `${k.keyword} (${k.volume})`)
  .join(', ')}
QUESTION VARIANTS: ${input.questionKeywords.slice(0, 8).join(', ')}

---
INTERNAL LINKING CANDIDATES (existing pages on this domain):
${
  input.internalLinkCandidates
    .map((p) => `- "${p.keyword}" → ${p.url} (pos ${p.rank})`)
    .join('\n') || 'None available'
}

---
VOLUME FOR PRIMARY KEYWORD: ${input.primaryVolume}/mo
COMPETITOR AVERAGE WORD COUNT: ${input.competitorAvgWc}

---
${
  input.brandContext?.brandName ||
  input.brandContext?.voiceNotes ||
  input.brandContext?.mentionRules
    ? `BRAND & VOICE (must follow):
${input.brandContext.brandName ? `Brand name: ${input.brandContext.brandName}` : ''}
${input.brandContext.voiceNotes ? `Voice & tone: ${input.brandContext.voiceNotes}` : ''}
${input.brandContext.mentionRules ? `Mention rules: ${input.brandContext.mentionRules}` : ''}
Research depth: ${input.brandContext.researchDepth ?? 'standard'}
`
    : ''
}
---
Return a JSON object with this exact shape:

{
  "primary_keyword": "${input.targetKeyword}",
  "secondary_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "template_type": "${input.template}",
  "template_rationale": "${input.templateRationale.replace(/"/g, '\\"')}",
  "title_options": ["title 1", "title 2", "title 3"],
  "suggested_meta_desc": "140-155 chars",
  "h1": "proposed H1",
  "outline": [
    { "level": "h2", "text": "heading", "notes": "what to cover — 1 sentence", "cite": "optional source to link out to" },
    { "level": "h3", "text": "heading", "notes": "what to cover", "cite": "" }
  ],
  "content_gaps": ["gap 1 with evidence", "gap 2 with evidence", "gap 3 with evidence"],
  "word_count_target": 1900,
  "word_count_min": 1600,
  "word_count_max": 2300,
  "competitor_avg_wc": ${input.competitorAvgWc},
  "suggested_links": [
    { "from_url": "/existing-page", "anchor": "anchor text", "target_section": "which H2 to place it under" }
  ],
  "ai_cited_brands": ${JSON.stringify(input.aiCitedBrands)},
  "ai_search_actions": ["action 1 to earn AI citations", "action 2", "action 3"],
  "traffic_position_1_3": ${input.traffic.position1_3},
  "traffic_position_5": ${input.traffic.position5},
  "tone_notes": "one sentence from domain + competitor analysis",
  "eeat_notes": "specific E-E-A-T signals to include",
  "angle": "differentiating angle vs competitors — one sentence",
  "required_assets": "images, schema types needed, examples"
}

Rules:
- word_count_target = competitor_avg_wc × 1.1 (aim 10% more thorough)
- 6–10 H2s; add H3s only where competitors consistently use them
- secondary_keywords: 5–8 most relevant from the related list
- content_gaps: specific things the top 3 miss, with evidence from scrape data
- suggested_links: only use URLs from the internal linking candidates list; [] if none match
- ai_search_actions: concrete (e.g. "add a structured comparison table", "cite the NHS study on X")
- Do not invent volume or KD figures — use only what was provided
- If AI overview was not triggered, set ai_cited_brands: [] and ai_search_actions: ["Monitor — AI overview not currently triggered for this query"]
`;
}

async function callClaude(prompt: string, retry = false): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.ANTHROPIC_BRIEF_MODEL?.trim() || resolveAnthropicModel();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: retry
        ? 'Output only valid JSON. No markdown. No preamble. Start with {'
        : `You are an expert SEO content strategist producing writer-ready content briefs.
Base every recommendation strictly on the data provided. Do not add generic SEO advice.
Output only valid JSON — no markdown fences, no preamble.`,
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

  return data.content?.find((block) => block.type === 'text')?.text ?? '';
}

function parseBriefJson(text: string): BriefOutput {
  const cleaned = text
    .trim()
    .replace(/^```json\n?/i, '')
    .replace(/\n?```$/i, '');
  return JSON.parse(cleaned) as BriefOutput;
}

export async function synthesiseBrief(
  input: BriefSynthesisInput,
): Promise<BriefOutput> {
  const prompt = buildPrompt(input);

  try {
    const text = await callClaude(prompt);
    return parseBriefJson(text);
  } catch {
    const retryText = await callClaude(prompt, true);
    return parseBriefJson(retryText);
  }
}
