import 'server-only';

import {
  CLIENT_CSV_FIELDS,
  type ClientCsvMapResult,
  heuristicClientMapping,
  normalizeClientCsvMapping,
} from '~/lib/ai/client-csv-fields';
import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

export {
  CLIENT_CSV_FIELD_OPTIONS,
  CLIENT_CSV_FIELDS,
  heuristicClientMapping,
  type ClientCsvField,
  type ClientCsvMapResult,
} from '~/lib/ai/client-csv-fields';

const SYSTEM_PROMPT = `You map CSV exports of CRM/client lists to a fixed schema.

Given CSV headers and up to 5 sample rows, return ONLY valid JSON (no markdown):
{
  "mapping": {
    "<exact header>": "<field key or __skip__>"
  },
  "confidence": "high|medium|low",
  "notes": "optional short note"
}

Allowed field keys:
${CLIENT_CSV_FIELDS.map((f) => `- ${f}`).join('\n')}
- __skip__ for columns that should not be imported

Rules:
- Use exact header strings from the input as keys.
- Map every header (use __skip__ when unsure).
- company / organisation / business name → company_name
- first/last/given/surname → first_name / last_name
- email / e-mail → email (or contact_email if clearly a contact person column)
- phone / mobile / tel → phone
- street / address 1 → address_line_1
- postcode / zip → postcode
- type / client type → client_type when values look like individual/business/person/company
- Prefer company_name for B2B lists; prefer first_name for personal contact lists.`;

export async function suggestClientCsvColumnMapping(input: {
  headers: string[];
  sampleRows: string[][];
}): Promise<ClientCsvMapResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ...heuristicClientMapping(input.headers), aiUsed: false };
  }

  const model = resolveAnthropicModel();
  const payload = {
    headers: input.headers,
    sample_rows: input.sampleRows.slice(0, 5),
  };

  try {
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
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    });

    if (!res.ok) {
      return { ...heuristicClientMapping(input.headers), aiUsed: false };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ...heuristicClientMapping(input.headers), aiUsed: false };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      mapping?: CsvFieldMapping;
      confidence?: ClientCsvMapResult['confidence'];
      notes?: string;
    };

    return {
      mapping: normalizeClientCsvMapping(input.headers, parsed.mapping),
      confidence: parsed.confidence ?? 'medium',
      notes: parsed.notes,
      aiUsed: true,
    };
  } catch {
    return { ...heuristicClientMapping(input.headers), aiUsed: false };
  }
}
