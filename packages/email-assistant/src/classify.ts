import 'server-only';

import { type GenerateTextFn, callAnthropicText } from './anthropic';
import type { DraftOwnerContext } from './draft';
import { parseClassifyResponse } from './json';
import type { EmailThreadCategory } from './types';

export type ClassifyResult = {
  category: EmailThreadCategory | null;
  reason: string | null;
};

const CLASSIFY_SYSTEM = `You classify email threads for the mailbox owner.
Return ONLY JSON, no prose, no markdown fences:
{ "category": "needs_reply" | "no_reply", "reason": string|null }

Default bias: when the latest message is from a real person (not automated) TO the owner, prefer needs_reply unless it is clearly FYI-only with no expectation of a reply.

Use needs_reply when a real person expects a personal reply from the mailbox owner, including:
- Direct questions or asks ("can you…", "please…", "could you…", "let me know", "what do you think", "thoughts?", "are you free…")
- Soft asks and conversational check-ins from clients, colleagues, friends, or vendors (updates that imply a response, "hope you're well" openers that continue into a request, sharing news and waiting for a reaction)
- Scheduling / availability requests
- Approvals, decisions, quotes, feedback, sign-off, or next-step asks
- Follow-ups, nudges, or "just checking in" messages after the owner was involved
- Client or vendor messages that leave the ball in the owner's court

Use no_reply ONLY for:
- Newsletters, marketing, automated notifications, receipts, system alerts
- Pure FYI with no ask and no implied response (e.g. "no action needed", "fyi only", broadcast announcements)
- Mailing lists / no-reply addresses / clearly automated senders
- CC'd threads with no ask of the owner
- Threads where the owner already sent the latest message and is waiting on someone else

When unsure, choose needs_reply. A short human email that invites a continuation almost always needs_reply.`;

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
    return { category: 'no_reply', reason: 'Empty thread' };
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
