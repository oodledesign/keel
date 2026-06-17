import 'server-only';

import { z } from 'zod';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

const PaymentPlanItemSchema = z.object({
  label: z.string(),
  percent: z.number().min(0).max(100),
});

const ContractDraftSchema = z.object({
  content_html: z.string(),
  payment_plan: z.array(PaymentPlanItemSchema),
  total_pence: z.number().int().nonnegative(),
});

export type ContractPaymentPlanItem = z.infer<typeof PaymentPlanItemSchema>;

export type ContractDraft = z.infer<typeof ContractDraftSchema>;

export type ContractGenerateParams = {
  accountName: string;
  senderName: string;
  recipientName: string;
  recipientCompany?: string | null;
  proposalHtml: string;
  /** Total deal value in pounds (GBP), if known. */
  dealValue?: number | null;
};

const CONTRACT_SYSTEM_PROMPT = `You draft UK services agreements for freelance and agency engagements.

Return ONLY valid JSON (no markdown fences) matching this shape:
{
  "content_html": "string — agreement body as simple HTML fragments (h2, p, ul, li, strong, em only; no document wrapper)",
  "payment_plan": [
    { "label": "string — milestone description", "percent": number }
  ],
  "total_pence": number
}

Rules:
- British English. Professional, clear, balanced tone suitable for B2B services.
- Parties: the service provider (from sender/workspace details) and the client (recipient).
- Include standard UK freelance clauses: services scope, deliverables, timelines, revisions, intellectual property (client owns final deliverables upon full payment unless otherwise stated), confidentiality, limitation of liability, termination, governing law (England and Wales unless context suggests Scotland), and signatures block placeholders.
- Extract the payment schedule from the proposal HTML. payment_plan percentages must sum to 100.
- total_pence: convert the agreed total to integer pence (GBP). If the proposal gives a pound amount, multiply by 100. If unclear, infer a reasonable total from scope or use 0.
- content_html must NOT include payment_plan as a separate JSON field — embed payment terms in prose and/or a ul list, consistent with payment_plan.
- Do not invent specific dates or amounts not implied by the proposal; use placeholders like "[Start date]" where needed.`;

function buildContractUserPayload(params: ContractGenerateParams) {
  return {
    provider_workspace: params.accountName,
    provider_name: params.senderName,
    client_name: params.recipientName,
    client_company: params.recipientCompany?.trim() || null,
    deal_value_gbp: params.dealValue ?? null,
    proposal_html: params.proposalHtml.slice(0, 80_000),
  };
}

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = resolveAnthropicModel();

  return { apiKey, model };
}

function parseJsonFromModelText(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const unfenced = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(unfenced);
    } catch {
      const start = unfenced.indexOf('{');
      const end = unfenced.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(unfenced.slice(start, end + 1));
      }
      throw new Error('Model did not return parseable JSON');
    }
  }
}

function normalizePaymentPlan(
  items: ContractPaymentPlanItem[],
): ContractPaymentPlanItem[] {
  const mapped = items.map((item) => ({
    label: item.label.trim(),
    percent: Math.round(item.percent * 100) / 100,
  }));

  const sum = mapped.reduce((acc, item) => acc + item.percent, 0);
  if (mapped.length === 0 || Math.abs(sum - 100) > 0.01) {
    return mapped;
  }

  return mapped;
}

export async function generateContractDraft(
  params: ContractGenerateParams,
): Promise<ContractDraft> {
  const { apiKey, model } = getAnthropicConfig();
  const payload = buildContractUserPayload(params);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: CONTRACT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Anthropic API error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = body.content?.find((c) => c.type === 'text');
  const raw = textBlock?.text?.trim();
  if (!raw) {
    throw new Error('Empty response from Anthropic');
  }

  const json = parseJsonFromModelText(raw);
  const parsed = ContractDraftSchema.parse(json);

  return {
    content_html: parsed.content_html.trim(),
    payment_plan: normalizePaymentPlan(parsed.payment_plan),
    total_pence: parsed.total_pence,
  };
}
