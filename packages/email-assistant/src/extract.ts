import 'server-only';

import { callAnthropicText } from './anthropic';
import { parseExtractResponse } from './json';
import type { EmailActionItem } from './types';

const EXTRACT_SYSTEM = `You extract concrete action items for the mailbox owner from an email thread.
Return ONLY JSON, no prose, no markdown fences:
{ "items": [ { "title": string, "detail": string|null, "suggested_due_date": "YYYY-MM-DD"|null } ] }

Rules:
- Only include actions the mailbox owner should personally take.
- Ignore FYIs, newsletters, automated notifications, and other people's tasks.
- Use [] when there are no actionable items.
- Infer due dates from phrases like "by Friday" or "next week" using the provided current date.
- Use null for suggested_due_date when no reasonable date can be inferred.
- Keep titles short and imperative; put supporting context in detail.`;

export async function extract(
  threadText: string,
  currentDate: string,
): Promise<EmailActionItem[]> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    return [];
  }

  const user = `Current date: ${currentDate}

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
