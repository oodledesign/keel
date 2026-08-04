import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';

export type ActivityClientOption = {
  id: string;
  name: string;
};

export type ActivityProjectOption = {
  id: string;
  name: string;
  clientId?: string | null;
};

export type ActivityBlockForSuggest = {
  id: string;
  appName: string;
  domain: string | null;
  url: string | null;
  windowTitle: string;
  durationSeconds: number;
};

export type ActivityAssignmentSuggestion = {
  blockId: string;
  clientId: string | null;
  projectId: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
};

const SYSTEM_PROMPT = `You assign desktop activity sessions to clients and projects for a UK creative/digital agency workspace.

Return ONLY valid JSON (no markdown):
{
  "suggestions": [
    {
      "blockId": "<uuid>",
      "clientId": "<uuid or null>",
      "projectId": "<uuid or null>",
      "confidence": "high|medium|low",
      "reason": "optional short reason"
    }
  ]
}

Rules:
- Use only clientId and projectId from the provided lists.
- Match from window titles, URLs, domains, and app names (e.g. Figma file names, repo names, client portals).
- Prefer assigning both client and project when confident; client-only is acceptable.
- Use null when genuinely uncertain — do not guess.
- High confidence only when the URL/title clearly names a client or project from the list.`;

export async function suggestActivityAssignments(input: {
  clients: ActivityClientOption[];
  projects: ActivityProjectOption[];
  blocks: ActivityBlockForSuggest[];
  accountId: string;
  supabase: SupabaseClient;
}): Promise<ActivityAssignmentSuggestion[]> {
  if (!input.blocks.length) {
    return [];
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return heuristicActivitySuggestions(input);
    }

    const payload = {
      clients: input.clients,
      projects: input.projects,
      blocks: input.blocks.map((block) => ({
        id: block.id,
        appName: block.appName,
        domain: block.domain,
        url: block.url,
        windowTitle: block.windowTitle,
        durationSeconds: block.durationSeconds,
      })),
    };

    const text = await callAI({
      feature: 'activity_assignment_suggest',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify(payload),
      accountId: input.accountId,
      supabase: input.supabase,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return heuristicActivitySuggestions(input);
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      suggestions?: ActivityAssignmentSuggestion[];
    };
    const validClientIds = new Set(input.clients.map((c) => c.id));
    const validProjectIds = new Set(input.projects.map((p) => p.id));

    return (parsed.suggestions ?? [])
      .filter((s) => input.blocks.some((b) => b.id === s.blockId))
      .map((s) => ({
        blockId: s.blockId,
        clientId:
          s.clientId && validClientIds.has(s.clientId) ? s.clientId : null,
        projectId:
          s.projectId && validProjectIds.has(s.projectId) ? s.projectId : null,
        confidence: s.confidence ?? 'medium',
        reason: s.reason,
      }))
      .filter((s) => s.clientId || s.projectId);
  } catch (err) {
    if (isInsufficientCreditsError(err)) throw err;
    console.warn(
      '[activity-assignment-suggest] Falling back to heuristics:',
      err,
    );
    return heuristicActivitySuggestions(input);
  }
}

function heuristicActivitySuggestions(input: {
  clients: ActivityClientOption[];
  projects: ActivityProjectOption[];
  blocks: ActivityBlockForSuggest[];
}): ActivityAssignmentSuggestion[] {
  const suggestions: ActivityAssignmentSuggestion[] = [];

  for (const block of input.blocks) {
    const haystack = [block.windowTitle, block.url, block.domain, block.appName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const client = input.clients.find((row) => {
      const name = row.name.trim().toLowerCase();
      return name.length > 2 && haystack.includes(name);
    });

    const project = input.projects.find((row) => {
      const name = row.name.trim().toLowerCase();
      return name.length > 2 && haystack.includes(name);
    });

    if (!client && !project) {
      continue;
    }

    suggestions.push({
      blockId: block.id,
      clientId: client?.id ?? project?.clientId ?? null,
      projectId: project?.id ?? null,
      confidence: 'medium',
      reason: 'Name match in title or URL',
    });
  }

  return suggestions;
}
