import 'server-only';

import { callAnthropicText } from './anthropic';
import { parseExtractResponse } from './json';
import type { EmailActionItem, ExtractContext } from './types';

const EXTRACT_SYSTEM = `You extract concrete action items from an email thread for a task review queue.
Return ONLY JSON, no prose, no markdown fences:
{
  "items": [
    {
      "title": string,
      "detail": string|null,
      "suggested_due_date": "YYYY-MM-DD"|null,
      "source_excerpt": string,
      "assignee_confidence": number,
      "suggested_assignee_email": string|null
    }
  ]
}

Rules:
- Only include explicit action items — commitments to do something, not FYIs or discussion topics.
- Use [] when there are no actionable items.
- Infer due dates from phrases like "by Friday" using the provided current date; use null when unknown.
- Keep titles short and imperative; put supporting context in detail.
- source_excerpt: verbatim quote from the thread supporting this task (max ~200 characters).

Assignee rules (critical):
- The mailbox owner is identified in the user message. Account members (name + email) are listed when available.
- Only assign a task to the mailbox owner when there is explicit evidence they committed to it
  (direct address, "I'll…", "Can you…" to them with acceptance, their reply committing to an action).
- Do NOT assign to the mailbox owner just because the task appeared in a thread they read or attended.
- If the source clearly assigns work to a named third party (e.g. "Sarah will send the contract"):
  - If Sarah matches an account member email, set suggested_assignee_email to that member's email.
  - Otherwise omit the item entirely — do not surface other people's tasks for the mailbox owner.
- When assignment is ambiguous, set suggested_assignee_email to null and assignee_confidence below 0.6.
- Never guess an assignee to avoid leaving tasks unassigned.
- assignee_confidence is 0-1 for how confident you are in suggested_assignee_email (use null email → confidence ≤ 0.5).`;

function formatExtractInstructionsBlock(
  instructions: string | null | undefined,
): string {
  const trimmed = instructions?.trim();
  if (!trimmed) return '';

  return `\nUser instructions (follow these when deciding what to extract, how to group items, and how to word tasks):\n${trimmed.slice(0, 2000)}\n`;
}

function buildMemberList(context: ExtractContext): string {
  if (context.accountMembers.length === 0) {
    return 'Account members: (none linked — only surface tasks explicitly for the mailbox owner)';
  }

  const lines = context.accountMembers.map((member) => {
    const label = member.name?.trim() || member.email;
    return `- ${label} <${member.email}>`;
  });

  return `Account members:\n${lines.join('\n')}`;
}

export async function extract(
  threadText: string,
  currentDate: string,
  context: ExtractContext,
): Promise<EmailActionItem[]> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    return [];
  }

  const ownerLabel = context.mailboxOwnerName?.trim()
    ? `${context.mailboxOwnerName} <${context.mailboxOwnerEmail}>`
    : context.mailboxOwnerEmail;

  const user = `Current date: ${currentDate}

Mailbox owner: ${ownerLabel}

${buildMemberList(context)}${formatExtractInstructionsBlock(context.instructions)}

Email thread:
---
${trimmedThread}
---

Respond with JSON only.`;

  const raw = await callAnthropicText({
    system: EXTRACT_SYSTEM,
    user,
    maxTokens: 2048,
  });

  return parseExtractResponse(raw);
}
