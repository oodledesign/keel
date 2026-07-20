import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';
import {
  TASK_CSV_FIELDS,
  type TaskCsvMapResult,
  heuristicTaskMapping,
  normalizeTaskCsvMapping,
} from '~/lib/ai/task-csv-fields';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

export {
  TASK_CSV_FIELD_OPTIONS,
  TASK_CSV_FIELDS,
  heuristicTaskMapping,
  type TaskCsvField,
  type TaskCsvMapResult,
} from '~/lib/ai/task-csv-fields';

const SYSTEM_PROMPT = `You map CSV exports of task lists to a fixed schema.

Given CSV headers and up to 5 sample rows, return ONLY valid JSON (no markdown):
{
  "mapping": {
    "<exact header>": "<field key or __skip__>"
  },
  "confidence": "high|medium|low",
  "notes": "optional short note"
}

Allowed field keys:
${TASK_CSV_FIELDS.map((f) => `- ${f}`).join('\n')}
- __skip__ for columns that should not be imported

Rules:
- Use exact header strings from the input as keys.
- Map every header (use __skip__ when unsure).
- title / task / name / subject → title (required)
- notes / description / details / body → notes
- due / deadline / due date → due_date
- priority / urgency → priority
- status / state → status
- client / customer → client_name
- project / job → project_name`;

export async function suggestTaskCsvColumnMapping(input: {
  headers: string[];
  sampleRows: string[][];
}): Promise<TaskCsvMapResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ...heuristicTaskMapping(input.headers), aiUsed: false };
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
      return { ...heuristicTaskMapping(input.headers), aiUsed: false };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ...heuristicTaskMapping(input.headers), aiUsed: false };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      mapping?: CsvFieldMapping;
      confidence?: TaskCsvMapResult['confidence'];
      notes?: string;
    };

    return {
      mapping: normalizeTaskCsvMapping(input.headers, parsed.mapping),
      confidence: parsed.confidence ?? 'medium',
      notes: parsed.notes,
      aiUsed: true,
    };
  } catch {
    return { ...heuristicTaskMapping(input.headers), aiUsed: false };
  }
}
