import 'server-only';

import { callAnthropicText } from './anthropic';
import { appendSignature } from './signature';

export type DraftOwnerContext = {
  email: string;
  displayName?: string | null;
};

const DRAFT_SYSTEM = `You draft email replies on behalf of the mailbox owner only.
Write only the reply body in plain text from the owner's first-person perspective.
The owner is the person sending this reply — never write as, sign as, or impersonate any recipient, CC, or person mentioned in the thread.
If the thread names other people, you may greet or refer to them, but closings and sign-offs must be from the owner only (never use another person's name as the sender).
Match the owner's tone using any style notes provided.
Be concise, professional, and ready for the owner to review before sending.
Do not include subject lines, markdown, or email headers.
Do not include a signature block — the app appends it separately.`;

function buildOwnerBlock(owner: DraftOwnerContext): string {
  const email = owner.email.trim();
  const name = owner.displayName?.trim();

  if (name) {
    return `Mailbox owner (you are writing as this person only):\nName: ${name}\nEmail: ${email}\n\n`;
  }

  return `Mailbox owner (you are writing as this person only):\nEmail: ${email}\n\n`;
}

export async function draft(
  threadText: string,
  owner: DraftOwnerContext,
  styleNotes: string | null | undefined,
  signature: string | null | undefined,
): Promise<string> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    throw new Error('Thread text is required to draft a reply');
  }

  if (!owner.email.trim()) {
    throw new Error('Mailbox owner email is required to draft a reply');
  }

  const styleBlock = styleNotes?.trim()
    ? `Owner style notes:\n${styleNotes.trim()}\n\n`
    : '';

  const user = `${buildOwnerBlock(owner)}${styleBlock}Email thread:
---
${trimmedThread}
---

Write the reply body only, as the mailbox owner.`;

  const body = await callAnthropicText({
    system: DRAFT_SYSTEM,
    user,
    maxTokens: 2048,
  });

  return appendSignature(body, signature);
}

export { appendSignature } from './signature';
