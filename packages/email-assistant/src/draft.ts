import 'server-only';

import { callAnthropicText } from './anthropic';
import { appendSignature } from './signature';

const DRAFT_SYSTEM = `You draft email replies for the mailbox owner.
Write only the reply body in plain text.
Match the owner's tone using any style notes provided.
Be concise, professional, and ready for the owner to review before sending.
Do not include subject lines, markdown, or email headers.
Do not include a signature block — the app appends it separately.`;

export async function draft(
  threadText: string,
  styleNotes: string | null | undefined,
  signature: string | null | undefined,
): Promise<string> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    throw new Error('Thread text is required to draft a reply');
  }

  const styleBlock = styleNotes?.trim()
    ? `Owner style notes:\n${styleNotes.trim()}\n\n`
    : '';

  const user = `${styleBlock}Email thread:
---
${trimmedThread}
---

Write the reply body only.`;

  const body = await callAnthropicText({
    system: DRAFT_SYSTEM,
    user,
    maxTokens: 2048,
  });

  return appendSignature(body, signature);
}

export { appendSignature } from './signature';
