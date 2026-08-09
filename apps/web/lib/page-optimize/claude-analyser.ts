import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { callAI, invokeAIProvider, withMeteredAI } from '~/lib/ai/router';
import type { CompetitorPage } from '~/lib/briefs/types';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type { PageOptimizeAnalysis } from './types';

type AnalysePageInput = {
  sourceUrl: string;
  targetKeyword: string;
  page: CompetitorPage;
  serpResults: Array<{ title: string; url: string }>;
  competitorPages: CompetitorPage[];
};

export type RanklyAiMeter = {
  accountId: string;
  supabase: SupabaseClient;
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

function parseAnalysis(text: string): PageOptimizeAnalysis {
  const cleaned = text
    .trim()
    .replace(/^```json\n?/i, '')
    .replace(/\n?```$/i, '');
  return JSON.parse(cleaned) as PageOptimizeAnalysis;
}

export async function resolveRanklyProjectAccountId(
  projectId: string,
): Promise<string> {
  const { data, error } = await supabaseCustomSchema(
    getSupabaseServerAdminClient(),
    'rankly',
  )
    .from('projects')
    .select('account_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !data?.account_id) {
    throw new Error(error?.message ?? 'Rankly project account not found');
  }

  return data.account_id as string;
}

export async function detectPageKeyword(
  page: CompetitorPage,
  meter: RanklyAiMeter,
): Promise<string> {
  const text = await callAI({
    feature: 'rankly_page_analyse',
    systemPrompt:
      'Return only the single best target SEO keyword phrase for this page. No punctuation or explanation.',
    userPrompt: `URL: ${page.url}
Title: ${page.title}
H1: ${page.h1s[0] ?? ''}
H2s: ${page.h2s.slice(0, 5).join(', ')}`,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });

  const keyword = text.trim().replace(/^["']|["']$/g, '');
  if (!keyword) {
    throw new Error('Failed to detect keyword');
  }
  return keyword;
}

export async function analysePageForOptimization(
  input: AnalysePageInput,
  meter: RanklyAiMeter,
): Promise<PageOptimizeAnalysis> {
  const prompt = buildPrompt(input);

  return withMeteredAI({
    feature: 'rankly_page_analyse',
    accountId: meter.accountId,
    supabase: meter.supabase,
    run: async () => {
      let lastTokens: {
        inputTokens: number | null;
        outputTokens: number | null;
      } = { inputTokens: null, outputTokens: null };

      for (const retry of [false, true]) {
        const result = await invokeAIProvider({
          feature: 'rankly_page_analyse',
          systemPrompt: retry
            ? 'Output only valid JSON. No markdown. Start with {'
            : 'You are an expert SEO analyst. Output only valid JSON.',
          userPrompt: prompt,
        });
        lastTokens = {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
        try {
          return {
            result: parseAnalysis(result.text),
            ...lastTokens,
          };
        } catch {
          if (retry)
            throw new Error('Failed to parse page optimization analysis');
        }
      }

      throw new Error('Failed to analyse page');
    },
  });
}
