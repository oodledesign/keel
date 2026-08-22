import 'server-only';

import { type GenerateTextFn, callAnthropicText } from './anthropic';
import type { DraftOwnerContext } from './draft';
import { parseDetectPipelineLeadResponse } from './json';
import type { PipelineLeadDetection } from './types';

const DETECT_LEAD_SYSTEM = `You detect whether an inbound email thread is a new business enquiry that should become a CRM pipeline lead.
Return ONLY JSON, no prose, no markdown fences:
{
  "is_lead": boolean,
  "contact_name": string|null,
  "company_name": string|null,
  "contact_email": string|null,
  "description": string|null,
  "reason": string|null,
  "confidence": number
}

confidence is 0-1.

Mark is_lead true when a human is reaching out about new business: sales enquiry, viewing request, project brief, referral intro, quote request, "looking for", RFP, or similar first-contact opportunity.

Mark is_lead false for:
- Existing client relationship updates, support, invoices, scheduling already in progress
- Newsletters, marketing, automated receipts, internal team mail
- Threads where the mailbox owner initiated outreach (cold follow-up to their own lead)
- Vague FYI with no commercial intent

When is_lead is true, extract the best contact name, company, and sender email from the thread.
description: one sentence summarising the opportunity (max 200 chars).`;

function buildOwnerBlock(owner: DraftOwnerContext): string {
  const email = owner.email.trim();
  const name = owner.displayName?.trim();

  if (name) {
    return `Mailbox owner:\nName: ${name}\nEmail: ${email}\n\n`;
  }

  return `Mailbox owner:\nEmail: ${email}\n\n`;
}

export async function detectPipelineLead(
  threadText: string,
  owner: DraftOwnerContext,
  generateText: GenerateTextFn = callAnthropicText,
): Promise<PipelineLeadDetection> {
  const trimmedThread = threadText.trim();

  if (!trimmedThread) {
    return {
      isLead: false,
      contactName: null,
      companyName: null,
      contactEmail: null,
      description: null,
      reason: 'Empty thread',
      confidence: null,
    };
  }

  const user = `${buildOwnerBlock(owner)}Email thread:
---
${trimmedThread}
---

Respond with JSON only.`;

  const raw = await generateText({
    system: DETECT_LEAD_SYSTEM,
    user,
    maxTokens: 320,
  });

  return parseDetectPipelineLeadResponse(raw);
}
