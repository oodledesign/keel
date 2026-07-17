import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { ProjectBriefSettings } from '~/lib/briefs/project-settings';
import { loadProjectBriefSettings } from '~/lib/briefs/project-settings';
import { fetchQuestionKeywords } from '~/lib/briefs/serp-analysis';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { normaliseDomain } from './crawl';
import type { PageCrawl } from './types';
import {
  CITATION_CONTEXTUAL_PROMPTS_GOOGLE,
  CITATION_CONTEXTUAL_PROMPTS_LLM,
} from './types';

const QUESTION_LIKE =
  /^(how|what|why|when|where|who|which|can|should|is|are|do|does)\b/i;

function homepageFromPages(
  domain: string,
  pages: PageCrawl[],
): PageCrawl | undefined {
  const host = normaliseDomain(domain);
  return (
    pages.find((page) => {
      try {
        const pathname = new URL(page.url).pathname;
        return pathname === '/' || pathname === '';
      } catch {
        return page.url.includes(host);
      }
    }) ?? pages[0]
  );
}

function resolveBrandName(
  brief: ProjectBriefSettings,
  homepage: PageCrawl | undefined,
): string {
  if (brief.brief_brand_name?.trim()) {
    return brief.brief_brand_name.trim();
  }

  const orgSchema = homepage?.jsonLd.find(
    (block) => block.type === 'Organization' || block.type === 'LocalBusiness',
  );
  if (typeof orgSchema?.raw?.name === 'string' && orgSchema.raw.name.trim()) {
    return orgSchema.raw.name.trim();
  }

  const host = homepage?.url ? normaliseDomain(homepage.url) : 'this company';
  return host.split('.')[0] ?? host;
}

function resolvePrimaryService(
  domain: string,
  homepage: PageCrawl | undefined,
): string {
  const serviceFromHeading = homepage?.h2s
    .map((heading) => heading.replace(/[^a-zA-Z0-9\s&/-]/g, '').trim())
    .find((heading) => heading.length > 4 && heading.length < 60);

  if (serviceFromHeading) return serviceFromHeading.toLowerCase();

  const host = normaliseDomain(domain);
  return `${host.split('.')[0] ?? host} services`;
}

function faqStylePrompts(pages: PageCrawl[], brand: string): string[] {
  const prompts: string[] = [];

  for (const page of pages) {
    if (!page.faqPatternPresent) continue;

    for (const heading of [...page.h2s, ...page.h3s].slice(0, 4)) {
      const trimmed = heading.trim();
      if (!trimmed.endsWith('?') && !QUESTION_LIKE.test(trimmed)) continue;
      prompts.push(
        trimmed.includes(brand)
          ? trimmed
          : `${trimmed.replace(/\?$/, '')} — does ${brand} do this well?`,
      );
    }
  }

  return prompts;
}

export function deriveContextualPrompts(
  domain: string,
  pages: PageCrawl[],
  brief: ProjectBriefSettings,
  extras?: {
    questionKeywords?: string[];
    briefKeywords?: string[];
  },
): string[] {
  const homepage = homepageFromPages(domain, pages);
  const brand = resolveBrandName(brief, homepage);
  const service = resolvePrimaryService(domain, homepage);
  const prompts: string[] = [];

  prompts.push(
    `I'm evaluating ${service} providers in the UK — would ${brand} be a good fit and why?`,
    `Who are the most trusted options for ${service}, and how does ${brand} compare?`,
    `What should I know before choosing ${brand} for ${service}?`,
    `We're shortlisting vendors for ${service} — is ${brand} worth a sales call?`,
  );

  if (brief.brief_voice_notes?.trim()) {
    const snippet = brief.brief_voice_notes.trim().slice(0, 120);
    prompts.push(
      `For a team that cares about "${snippet}" — would ${brand} be a strong ${service} partner?`,
    );
  }

  if (brief.brief_mention_rules?.trim()) {
    const snippet = brief.brief_mention_rules.trim().slice(0, 100);
    prompts.push(
      `When researching ${service}, how should ${brand} be positioned: ${snippet}?`,
    );
  }

  for (const kw of extras?.questionKeywords ?? []) {
    const trimmed = kw.trim();
    if (!trimmed || trimmed.length < 8) continue;
    prompts.push(trimmed.endsWith('?') ? trimmed : `${trimmed}?`);
  }

  for (const kw of extras?.briefKeywords ?? []) {
    const trimmed = kw.trim();
    if (!trimmed || trimmed.length < 4) continue;
    prompts.push(
      `Which ${trimmed} provider would you recommend — is ${brand} on the list?`,
    );
  }

  prompts.push(...faqStylePrompts(pages, brand));

  return [...new Set(prompts.map((prompt) => prompt.slice(0, 500)))].slice(
    0,
    CITATION_CONTEXTUAL_PROMPTS_GOOGLE,
  );
}

export function sliceContextualPromptsForLlm(prompts: string[]): string[] {
  return prompts.slice(0, CITATION_CONTEXTUAL_PROMPTS_LLM);
}

async function loadLatestBriefKeywords(projectId: string): Promise<string[]> {
  const db = supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');

  const { data: brief } = await db
    .from('content_briefs')
    .select('target_keyword, primary_keyword, secondary_keywords')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brief) return [];

  const keywords = [
    brief.target_keyword,
    brief.primary_keyword,
    ...((brief.secondary_keywords as string[] | null) ?? []),
  ]
    .filter(
      (kw): kw is string => typeof kw === 'string' && kw.trim().length > 0,
    )
    .map((kw) => kw.trim());

  return [...new Set(keywords)];
}

export async function loadContextualPromptInputs(input: {
  projectId: string;
  domain: string;
  pages: PageCrawl[];
  locationCode: number;
}): Promise<string[]> {
  const brief = await loadProjectBriefSettings(input.projectId);
  const briefKeywords = await loadLatestBriefKeywords(input.projectId);
  const homepage = homepageFromPages(input.domain, input.pages);
  const service = resolvePrimaryService(input.domain, homepage);

  let questionKeywords: string[] = [];
  try {
    questionKeywords = await fetchQuestionKeywords(service, input.locationCode);
  } catch {
    questionKeywords = [];
  }

  return deriveContextualPrompts(input.domain, input.pages, brief, {
    questionKeywords: questionKeywords.slice(0, 5),
    briefKeywords: briefKeywords.slice(0, 4),
  });
}
