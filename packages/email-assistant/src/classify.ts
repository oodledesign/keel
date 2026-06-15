import 'server-only';

import { callAnthropicText } from './anthropic';
import type { DraftOwnerContext } from './draft';
import { parseClassifyResponse } from './json';
import type { EmailThreadCategory } from './types';

export type ClassifyResult = {
  category: EmailThreadCategory;
  reason: string | null;
};

const CLASSIFY_SYSTEM = `You classify email threads for the mailbox owner.
Return ONLY JSON, no prose, no markdown fences:
{ "category": "needs_reply" | "no_reply", "reason": string|null }

Use needs_reply when a real person expects a personal reply from the mailbox owner.
Use no_reply for newsletters, marketing, automated notifications, receipts, FYI-only updates, mailing lists, and threads where the owner already sent the latest message and is waiting on someone else.
When unsure between a polite human message and automated mail, prefer needs_reply only if a personal response is clearly expected.`;

function buildOwnerBlock(owner: DraftOwnerContext): string {
  const email = owner.email.trim();
  const name = owner.displayName?.trim();

  if (name) {
    return `Mailbox owner:\nName: ${name}\nEmail: ${email}\n\n`;
  }

  return `Mailbox owner:\nEmail: ${email}\n\n`;
}

export async function classify(
  threadText: string,
  owner: DraftOwnerContext,
): Promise<ClassifyResult> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    return { category: 'no_reply', reason: 'Empty thread' };
  }

  const user = `${buildOwnerBlock(owner)}Email thread:
---
${trimmedThread}
---

Respond with JSON only.`;

  const raw = await callAnthropicText({
    system: CLASSIFY_SYSTEM,
    user,
    maxTokens: 256,
  });

  return parseClassifyResponse(raw);
}
