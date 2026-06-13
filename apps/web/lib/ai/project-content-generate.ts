import 'server-only';

import { z } from 'zod';

import { extractJsonObject } from '~/lib/ai/extract-json-object';

export type ProjectSourceBlock = {
  type: 'transcript' | 'proposal' | 'note' | 'file';
  id: string;
  title: string;
  content: string;
};

export type ProjectGenerateMode = 'brief' | 'phase_plan' | 'phase_page';

const PhasePlanTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().nullable().optional(),
});

const PhasePlanPhaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  is_milestone: z.boolean().optional(),
  tasks: z.array(PhasePlanTaskSchema).default([]),
});

export const PhasePlanSchema = z.object({
  phases: z.array(PhasePlanPhaseSchema).min(1),
});

export type PhasePlan = z.infer<typeof PhasePlanSchema>;

const SYSTEM_BASE = `You are a delivery lead at a web/SEO agency. Use ONLY the provided sources.
Be concrete, UK English, no invented facts. If information is missing, say so briefly rather than guessing.`;

const MAX_PER_SOURCE = 28_000;
const MAX_TOTAL_SOURCES = 110_000;

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
  return { apiKey, model };
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProjectSourceCorpus(sources: ProjectSourceBlock[]): string {
  let total = 0;
  const blocks: string[] = [];

  for (const source of sources) {
    const label =
      source.type === 'transcript'
        ? 'Meeting transcript'
        : source.type === 'proposal'
          ? 'Proposal'
          : source.type === 'note'
            ? 'Note'
            : 'Document';

    let content = source.content.trim();
    if (source.type === 'proposal') {
      content = stripHtml(content);
    }
    const slice = content.slice(0, MAX_PER_SOURCE);
    const block = `--- SOURCE [${label}] id=${source.id} title="${source.title}" ---\n${slice}\n--- END SOURCE ---`;
    if (total + block.length > MAX_TOTAL_SOURCES) break;
    blocks.push(block);
    total += block.length;
  }

  return blocks.join('\n\n') || '(no source content)';
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const { apiKey, model } = getAnthropicConfig();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

export async function generateProjectBriefMarkdown(params: {
  jobTitle: string;
  clientName?: string | null;
  sources: ProjectSourceBlock[];
}): Promise<string> {
  const corpus = buildProjectSourceCorpus(params.sources);
  const system = `${SYSTEM_BASE}

Write a structured project brief in Markdown with these sections (use ## headings):
## Problem
## Goals
## Scope
## Audience
## Deliverables
## Risks

Use bullet lists where helpful. Do not wrap in markdown fences.`;

  const user = `Project: ${params.jobTitle}
Client: ${params.clientName?.trim() || 'Unknown'}

Sources:
${corpus}`;

  return callAnthropic(system, user);
}

export async function generatePhasePlanJson(params: {
  jobTitle: string;
  clientName?: string | null;
  sources: ProjectSourceBlock[];
}): Promise<{ plan: PhasePlan } | { rawDraft: string; parseError: true }> {
  const corpus = buildProjectSourceCorpus(params.sources);
  const system = `${SYSTEM_BASE}

Return ONLY valid JSON (no markdown fences) matching:
{
  "phases": [
    {
      "name": "string",
      "description": "string or null",
      "start_date": "YYYY-MM-DD or null",
      "due_date": "YYYY-MM-DD or null",
      "is_milestone": false,
      "tasks": [
        { "title": "string", "priority": "low|medium|high|urgent", "due_date": "YYYY-MM-DD or null" }
      ]
    }
  ]
}
Prefer a sensible agency delivery spine (Discovery → Design → Build → Launch → Care) when sources support it.
Include concrete tasks drawn from the sources.`;

  const user = `Project: ${params.jobTitle}
Client: ${params.clientName?.trim() || 'Unknown'}

Sources:
${corpus}`;

  const raw = await callAnthropic(system, user);

  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as unknown;
    const result = PhasePlanSchema.safeParse(parsed);
    if (!result.success) {
      return { rawDraft: raw, parseError: true };
    }
    return { plan: result.data };
  } catch {
    return { rawDraft: raw, parseError: true };
  }
}

export async function generatePhasePageMarkdown(params: {
  phaseName: string;
  jobTitle: string;
  clientName?: string | null;
  existingContent?: string | null;
  sources: ProjectSourceBlock[];
}): Promise<string> {
  const corpus = buildProjectSourceCorpus(params.sources);
  const system = `${SYSTEM_BASE}

Write Markdown content for a single delivery phase page. Use ## and ### headings, bullet lists, and checklists.
Cover: objectives, key activities, deliverables, dependencies, and open questions — only where supported by sources.
Do not wrap in markdown fences.`;

  const existing = params.existingContent?.trim();
  const user = `Project: ${params.jobTitle}
Phase: ${params.phaseName}
Client: ${params.clientName?.trim() || 'Unknown'}
${existing ? `\nExisting page content (extend and integrate — do not repeat verbatim):\n${existing.slice(0, 8000)}\n` : ''}

Sources:
${corpus}`;

  const generated = await callAnthropic(system, user);

  if (!existing) return generated;
  return `${existing.trim()}\n\n---\n\n${generated.trim()}`;
}
