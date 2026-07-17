import 'server-only';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';

import type { QuickActionContext } from './context';
import {
  quickActionToolDefinitions,
  runQuickActionTool,
} from './tools/registry';
import type { ProposedQuickAction, QuickActionPlanResponse } from './types';

const MAX_TOOL_ROUNDS = 3;

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment to use quick actions.',
    );
  }

  const model =
    process.env.ANTHROPIC_QUICK_ACTION_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    'claude-haiku-4-5';

  return { apiKey, model };
}

function buildSystemPrompt(ctx: QuickActionContext): string {
  const today = todayLocalYmd();
  const pageHint = ctx.pageContext.accountSlug
    ? `The user is currently viewing workspace "${ctx.pageContext.accountSlug}".`
    : 'The user may be on their personal workspace.';

  return `You are Ozer Quick Action — an assistant that turns natural language into concrete actions inside the Ozer app.

Today is ${today} (local calendar). ${pageHint}

You can help with:
1. Creating tasks in a team workspace (with title, notes, due date, optional project/client link)
2. Running a PageSpeed scan for a Rankly SEO project

Workflow:
- Always call list_workspaces first when a workspace name is mentioned.
- For tasks: call list_workspace_assignments when a project or client might apply.
- For PageSpeed: call list_rankly_projects with a query to find the project.
- When you have enough information, call propose_create_task or propose_pagespeed_scan — never invent UUIDs; only use IDs returned from list tools.
- Use due_date_phrase for relative dates like "this week" or "friday" when the user does not give an exact date.
- Write clear, actionable task titles. Put extra context in notes.
- If multiple workspaces or projects match, pick the best match and mention alternatives in your reply.
- Do not claim an action was executed — proposing only prepares a preview for the user to confirm.

Respond briefly in plain English when proposing actions.`;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: AnthropicMessage[],
  tools: typeof quickActionToolDefinitions,
) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      tools,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Anthropic API error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }

  return (await res.json()) as {
    content?: AnthropicContentBlock[];
    stop_reason?: string;
  };
}

function extractAssistantText(
  content: AnthropicContentBlock[] | undefined,
): string {
  if (!content?.length) return '';
  return content
    .filter(
      (block): block is { type: 'text'; text: string } => block.type === 'text',
    )
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export async function planQuickAction(
  ctx: QuickActionContext,
  message: string,
): Promise<QuickActionPlanResponse> {
  const { apiKey, model } = getAnthropicConfig();
  const system = buildSystemPrompt(ctx);

  const messages: AnthropicMessage[] = [
    { role: 'user', content: message.trim() },
  ];

  const proposedActions: ProposedQuickAction[] = [];
  let assistantMessage = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await callAnthropic(
      apiKey,
      model,
      system,
      messages,
      quickActionToolDefinitions,
    );

    const content = response.content ?? [];
    assistantMessage = extractAssistantText(content) || assistantMessage;

    const toolUses = content.filter(
      (block): block is Extract<AnthropicContentBlock, { type: 'tool_use' }> =>
        block.type === 'tool_use',
    );

    if (toolUses.length === 0) {
      break;
    }

    messages.push({ role: 'assistant', content });

    const toolResults: AnthropicContentBlock[] = [];

    for (const toolUse of toolUses) {
      try {
        const { result, proposedAction } = await runQuickActionTool(
          ctx,
          toolUse.name,
          toolUse.input,
        );
        if (proposedAction) {
          proposedActions.push(proposedAction);
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        } as unknown as AnthropicContentBlock);
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            error: err instanceof Error ? err.message : 'Tool failed',
          }),
          is_error: true,
        } as unknown as AnthropicContentBlock);
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!assistantMessage && proposedActions.length > 0) {
    assistantMessage = 'Review the action below and confirm to proceed.';
  }

  if (!assistantMessage && proposedActions.length === 0) {
    assistantMessage =
      'I could not figure out an action from that request. Try being more specific about the workspace and what you want to do.';
  }

  return {
    assistantMessage,
    proposedActions,
  };
}
