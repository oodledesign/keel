import 'server-only';

import { z } from 'zod';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';
import { extractJsonObject } from '~/lib/ai/extract-json-object';
import {
  calculateInvoiceLineTotalPence,
  normalizeInvoiceLineType,
} from '~/lib/invoices/invoice-quantity';

import type { AiInvoiceDraft } from '~/lib/ai/invoice-generate-types';

export type { AiInvoiceDraft };

const AiInvoiceLineSchema = z.object({
  description: z.string().min(1),
  description_detail: z.string().nullable().optional(),
  line_type: z.enum(['quantity', 'hours']).optional().default('quantity'),
  quantity: z.number().positive(),
  /** Unit price in major currency units (e.g. pounds), not pence. */
  unit_price: z.number().min(0),
});

export const AiInvoiceDraftSchema = z.object({
  title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(AiInvoiceLineSchema).min(1),
});

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return { apiKey, model: resolveAnthropicModel() };
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const { apiKey, model } = getAnthropicConfig();

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
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Empty response from Anthropic');
  return text;
}

function poundsToPence(value: number): number {
  return Math.max(0, Math.round(value * 100));
}

function normalizeQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapAiInvoiceDraft(
  raw: z.infer<typeof AiInvoiceDraftSchema>,
): AiInvoiceDraft {
  return {
    title: raw.title?.trim() || null,
    notes: raw.notes?.trim() || null,
    items: raw.items.map((item) => {
      const line_type = normalizeInvoiceLineType(item.line_type);
      const quantity = normalizeQuantity(item.quantity);
      const unit_price_pence = poundsToPence(item.unit_price);
      return {
        description: item.description.trim(),
        description_detail: item.description_detail?.trim() || null,
        line_type,
        quantity,
        unit_price_pence,
        total_pence: calculateInvoiceLineTotalPence(
          quantity,
          unit_price_pence,
        ),
      };
    }),
  };
}

export async function generateInvoiceDraftFromPrompt(input: {
  prompt: string;
  currency: string;
  currencySymbol: string;
  clientName?: string | null;
  defaultHourlyRatePence?: number | null;
}): Promise<AiInvoiceDraft> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error('Enter a description of the work and costings to generate');
  }

  const hourly =
    input.defaultHourlyRatePence && input.defaultHourlyRatePence > 0
      ? `${input.currencySymbol}${(input.defaultHourlyRatePence / 100).toFixed(2)} per hour`
      : 'not set — prefer quantity lines with explicit unit prices unless the user clearly describes hours';

  const system = `You turn rough invoice briefs into structured invoice line items for a UK agency product (Ozer).
Use UK English. Currency is ${input.currency} (symbol ${input.currencySymbol}).
Return ONLY valid JSON matching this shape:
{
  "title": string | null,
  "notes": string | null,
  "items": [
    {
      "description": string,
      "description_detail": string | null,
      "line_type": "quantity" | "hours",
      "quantity": number,
      "unit_price": number
    }
  ]
}
Rules:
- unit_price is in major currency units (e.g. 500 means ${input.currencySymbol}500.00), never pence.
- Prefer clear client-facing descriptions; put extra context in description_detail.
- Use line_type "hours" only when the brief clearly bills time; otherwise use "quantity".
- Split distinct deliverables into separate lines.
- Do not invent large packages of work that were not implied.
- If a total package price is given without a breakdown, create sensible lines that sum to that total.
- title/notes are optional invoice-level fields; leave null if not useful.
- Output JSON only — no markdown fences, no commentary.`;

  const user = `Client: ${input.clientName?.trim() || 'unknown'}
Default hourly rate: ${hourly}

Brief / costings:
${prompt.slice(0, 12_000)}`;

  const text = await callAnthropic(system, user);
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(text));
  } catch {
    throw new Error('AI returned invalid JSON for invoice lines');
  }

  const draft = AiInvoiceDraftSchema.safeParse(parsed);
  if (!draft.success) {
    throw new Error('AI invoice draft did not match the expected shape');
  }

  return mapAiInvoiceDraft(draft.data);
}
