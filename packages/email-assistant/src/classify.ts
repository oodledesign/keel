import 'server-only';

import { type GenerateTextFn, callAnthropicText } from './anthropic';
import type { DraftOwnerContext } from './draft';
import { parseClassifyResponse } from './json';
import type { EmailThreadCategory } from './types';

export type ClassifyResult = {
  category: EmailThreadCategory | null;
  reason: string | null;
  confidence: number | null;
};

const CLASSIFY_SYSTEM = `You classify email threads for the mailbox owner.
Return ONLY JSON, no prose, no markdown fences:
{ "category": "reply_now" | "reply_later" | "waiting" | "fyi" | "noise", "reason": string|null, "confidence": number }

confidence is 0-1 for how sure you are.

Categories:
- reply_now: Direct ask, urgent decision, scheduling, client waiting on the owner now
- reply_later: Important human mail that needs a reply but is not urgent
- waiting: Ball is in the other party's court; owner sent last or thread is pending their response
- fyi: Read-only updates, no reply expected
- noise: Newsletters, marketing, automated receipts/alerts, mailing lists

When a real person expects a personal reply soon, prefer reply_now over reply_later.
When unsure between reply_now and reply_later, choose reply_later with lower confidence.
When the owner already sent the latest message and is waiting on someone else, choose waiting.
When unsure between fyi and noise, choose fyi for human senders and noise for automated senders.`;

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
  generateText: GenerateTextFn = callAnthropicText,
): Promise<ClassifyResult> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    return { category: 'noise', reason: 'Empty thread', confidence: 1 };
  }

  const user = `${buildOwnerBlock(owner)}Email thread:
---
${trimmedThread}
---

Respond with JSON only.`;

  const raw = await generateText({
    system: CLASSIFY_SYSTEM,
    user,
    maxTokens: 256,
  });

  return parseClassifyResponse(raw);
}
