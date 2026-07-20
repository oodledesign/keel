import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

export type CsvColumnMapping = {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  reference?: string;
  notes?: string;
  spendingCategory?: string;
};

export type FinanceCsvMapResult = {
  mapping: CsvColumnMapping;
  dateFormat: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
};

const SYSTEM_PROMPT = `You map UK bank CSV exports to a fixed schema for import.

Given CSV headers and 3 sample rows, return ONLY valid JSON (no markdown):
{
  "mapping": {
    "date": "<exact header name for transaction date>",
    "description": "<exact header for payee/description>",
    "amount": "<optional single signed amount column>",
    "debit": "<optional money-out column>",
    "credit": "<optional money-in column>",
    "reference": "<optional payment reference, often property address>",
    "notes": "<optional free-text notes column>",
    "spendingCategory": "<optional bank spending category column>"
  },
  "dateFormat": "DD/MM/YYYY or YYYY-MM-DD or similar",
  "confidence": "high|medium|low",
  "notes": "optional short note"
}

Rules:
- Use exact header strings from the input.
- Prefer separate debit/credit columns when present (UK banks often use these).
- If only one amount column, use mapping.amount (negative = expense).
- For Starling exports: map "Counter Party" to description, "Reference" to reference, "Notes" to notes, "Spending Category" to spendingCategory.
- British date formats are common.`;

export async function suggestCsvColumnMapping(input: {
  headers: string[];
  sampleRows: string[][];
}): Promise<FinanceCsvMapResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return heuristicMapping(input.headers);
  }

  const model = resolveAnthropicModel();

  const payload = {
    headers: input.headers,
    sample_rows: input.sampleRows.slice(0, 5),
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!res.ok) {
    return heuristicMapping(input.headers);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return heuristicMapping(input.headers);

  try {
    return JSON.parse(jsonMatch[0]) as FinanceCsvMapResult;
  } catch {
    return heuristicMapping(input.headers);
  }
}

function heuristicMapping(headers: string[]): FinanceCsvMapResult {
  const lower = headers.map((h) => h.toLowerCase());
  const pick = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = lower.findIndex((h) => h.includes(c));
      if (i >= 0) return headers[i]!;
    }
    return headers[0] ?? '';
  };

  const debitIdx = lower.findIndex(
    (h) =>
      h.includes('debit') || h.includes('money out') || h.includes('paid out'),
  );
  const creditIdx = lower.findIndex(
    (h) =>
      h.includes('credit') || h.includes('money in') || h.includes('paid in'),
  );

  const referenceIdx = lower.findIndex(
    (header) => header === 'reference' || header.includes('reference'),
  );
  const notesIdx = lower.findIndex(
    (header) => header === 'notes' || header.includes('note'),
  );
  const spendingIdx = lower.findIndex(
    (header) =>
      header.includes('spending category') || header.includes('category'),
  );
  const counterPartyIdx = lower.findIndex(
    (header) => header.includes('counter party') || header.includes('counterparty'),
  );

  return {
    mapping: {
      date: pick('date', 'transaction date', 'posted'),
      description:
        counterPartyIdx >= 0
          ? headers[counterPartyIdx]!
          : pick('description', 'memo', 'narrative', 'details', 'payee'),
      ...(referenceIdx >= 0 ? { reference: headers[referenceIdx]! } : {}),
      ...(notesIdx >= 0 ? { notes: headers[notesIdx]! } : {}),
      ...(spendingIdx >= 0 ? { spendingCategory: headers[spendingIdx]! } : {}),
      ...(debitIdx >= 0 && creditIdx >= 0
        ? {
            debit: headers[debitIdx]!,
            credit: headers[creditIdx]!,
          }
        : {
            amount: pick(
              'amount (gbp)',
              'amount',
              'value',
              'transaction amount',
            ),
          }),
    },
    dateFormat: 'DD/MM/YYYY',
    confidence: 'medium',
    notes: 'Heuristic mapping (AI unavailable)',
  };
}

export function parseUkDate(value: string, hint?: string): string | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, '0');
    const month = dmy[2]!.padStart(2, '0');
    let year = dmy[3]!;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  if (hint?.includes('MM/DD')) {
    const mdy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      const month = mdy[1]!.padStart(2, '0');
      const day = mdy[2]!.padStart(2, '0');
      let year = mdy[3]!;
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function parseMoneyPence(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
