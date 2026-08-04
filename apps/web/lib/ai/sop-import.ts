import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { extractJsonObject } from '~/lib/ai/extract-json-object';
import { callAI } from '~/lib/ai/router';

const SopStepSchema = z.object({
  title: z.string().min(1),
  body_md: z.string().optional().nullable(),
});

const SopImportSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  recurrence: z.enum(['monthly', 'weekly', 'project', 'ad_hoc']).optional(),
  steps: z.array(SopStepSchema).min(1),
});

export type SopImportDraft = z.infer<typeof SopImportSchema>;

export async function extractSopPlaybookFromText(
  rawText: string,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<SopImportDraft> {
  const system = `You convert messy process documentation into a structured Standard Operating Procedure (SOP) playbook.
Return ONLY valid JSON (no markdown fences) matching:
{
  "title": "string — concise process name",
  "description": "string or null — when to use this process",
  "category": "string or null — e.g. Web design, SEO, PPC, Client onboarding",
  "recurrence": "monthly" | "weekly" | "project" | "ad_hoc",
  "steps": [
    { "title": "string — action-oriented step title", "body_md": "string or null — short instructions, links, or checklist sub-items in markdown" }
  ]
}
Rules:
- Order steps in the sequence a team member should follow.
- Each step should be one clear action (5–15 steps typical; split long docs into logical phases).
- Use recurrence "monthly" for reporting/review cycles, "project" for one-off deliverables like web builds, "weekly" for weekly ops.
- Preserve important details (tools, URLs, client names placeholders) in body_md.
- Do not invent steps not implied by the source text.`;

  const text = await callAI({
    feature: 'sop_import',
    systemPrompt: system,
    userPrompt: `Convert this into an SOP playbook JSON:\n\n---\n${rawText}\n---`,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });

  const rawJson = extractJsonObject(text || '{}');
  const parsed = JSON.parse(rawJson) as unknown;
  const result = SopImportSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      'AI returned an invalid SOP structure. Try again or add steps manually.',
    );
  }

  return {
    ...result.data,
    recurrence: result.data.recurrence ?? 'ad_hoc',
    steps: result.data.steps.map((step, index) => ({
      title: step.title.trim() || `Step ${index + 1}`,
      body_md: step.body_md?.trim() || null,
    })),
  };
}
