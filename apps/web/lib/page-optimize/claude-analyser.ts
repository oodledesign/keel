import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

import type { CompetitorPage } from '~/lib/briefs/types';

import type { PageOptimizeAnalysis } from './types';

type AnalysePageInput = {
  sourceUrl: string;
  targetKeyword: string;
  page: CompetitorPage;
  serpResults: Array<{ title: string; url: string }>;
  competitorPages: CompetitorPage[];
};

function buildPrompt(input: AnalysePageInput): string {
  return `
Analyse this existing page for SEO and content improvements versus the SERP for "${input.targetKeyword}".

PAGE URL: ${input.sourceUrl}
Title: ${input.page.title} (${input.page.title.length} chars)
Meta: ${input.page.metaDesc}
H1: ${input.page.h1s[0] ?? 'none'}
H2s: ${input.page.h2s.slice(0, 10).join(' | ') || 'none'}
Word count: ~${input.page.wordCount}

SERP TOP 10:
${input.serpResults.map((row, index) => `${index + 1}. ${row.title} — ${row.url}`).join('\n')}

TOP COMPETITOR PAGES:
${input.competitorPages
  .map(
    (page, index) => `
${index + 1}. ${page.url}
Title: ${page.title}
H1: ${page.h1s[0] ?? 'none'}
Word count: ~${page.wordCount}
H2s: ${page.h2s.slice(0, 6).join(' | ')}
`,
  )
  .join('\n')}

Return JSON only:
{
  "score": 72,
  "target_keyword": "${input.targetKeyword}",
  "title_suggestions": ["title 1", "title 2", "title 3"],
  "meta_suggestion": "140-155 char meta description",
  "rewrite_summary": "2-3 sentence summary of the highest-impact content changes",
  "recommendations": [
    {
      "priority": "high",
      "category": "on-page",
      "title": "Short title",
      "detail": "Why this matters with SERP evidence",
      "action": "Specific fix"
    }
  ]
}

Rules:
- score 0-100 based on on-page SEO, content depth vs SERP, and intent match
- 5-8 recommendations, ordered by impact
- categories: on-page, content, technical, serp
- Be specific to this URL — no generic SEO fluff
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
      max_tokens: 3000,
      system: retry
        ? 'Output only valid JSON. No markdown. Start with {'
        : 'You are an expert SEO analyst. Output only valid JSON.',
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

function parseAnalysis(text: string): PageOptimizeAnalysis {
  const cleaned = text
    .trim()
    .replace(/^```json\n?/i, '')
    .replace(/\n?```$/i, '');
  return JSON.parse(cleaned) as PageOptimizeAnalysis;
}

export async function detectPageKeyword(
  page: CompetitorPage,
): Promise<string> {
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
      max_tokens: 80,
      system:
        'Return only the single best target SEO keyword phrase for this page. No punctuation or explanation.',
      messages: [
        {
          role: 'user',
          content: `URL: ${page.url}
Title: ${page.title}
H1: ${page.h1s[0] ?? ''}
H2s: ${page.h2s.slice(0, 5).join(', ')}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to detect keyword');
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const keyword =
    data.content?.find((block) => block.type === 'text')?.text?.trim() ?? '';
  if (!keyword) {
    throw new Error('Could not detect a target keyword for this page');
  }

  return keyword.replace(/^["']|["']$/g, '');
}

export async function analysePageForOptimization(
  input: AnalysePageInput,
): Promise<PageOptimizeAnalysis> {
  const prompt = buildPrompt(input);

  try {
    const text = await callClaude(prompt);
    return parseAnalysis(text);
  } catch {
    const retryText = await callClaude(prompt, true);
    return parseAnalysis(retryText);
  }
}
