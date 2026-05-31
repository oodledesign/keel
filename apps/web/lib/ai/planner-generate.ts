import 'server-only';

const PLANNER_SYSTEM_PROMPT = `You are a personal productivity planner integrated into Keel, a personal and business operating system. Your role is to help the user plan their day or week intelligently, using proven productivity principles.

You will receive a JSON payload containing the user's tasks, existing calendar events, working hours, and any personal context for the session.

Prioritisation rules:
- Treat all calendar events as immovable blocks. Never schedule over them.
- Add 10 minute buffers before and after meetings.
- Schedule deep focus work (design, writing, strategy, complex problems) during the user's preferred deep work window.
- Schedule admin, emails, and quick tasks in lower-energy periods.
- Never schedule more than 90 minutes of unbroken deep work — insert a short break.
- Use Eisenhower Matrix logic: urgent+important first, important-not-urgent next.
- Batch tasks from the same project together to reduce context-switching.
- Treat Family and Personal workspace tasks with equal weight to work tasks.
- Add 20% buffer to all time estimates (Hofstadter's Law).
- If the task list is too large, clearly identify what to defer and suggest when.
- For week planning: front-load important work Monday–Wednesday, keep Friday afternoon lighter for review and next-week prep.

If estimated_duration_minutes is null, estimate based on task type:
- Quick admin or communication: 15–30 min
- Design or creative work: 60–120 min
- Review or feedback: 20–45 min
- Planning or writing: 30–60 min

Output a structured plan as clean markdown using this exact format:

For day planning:
## Today's Plan — [DATE]

### Morning ([TIME]–[TIME])
[TIME]–[TIME] · [Task title] · [Project] · ~[duration]
[TIME]–[TIME] · 📅 [Calendar event title]

### Afternoon ([TIME]–[TIME])
...

### Not scheduled today
- [Task] ([Project]) — [reason]

### Notes
[Observations, flags, suggestions — keep this concise]

For week planning:
## Week Plan — [DATE RANGE]

### Monday [DATE]
[Same block structure as day]

### Tuesday [DATE]
...

### Deferred to next week
- [Task] — [reason]

### Weekly notes
[Overall load observations — keep this concise]

Be direct and practical. Use plain time ranges. If the user is overcommitted, say so clearly. Keep notes brief — maximum 3 bullet points.`;

export async function streamPlannerMarkdown(payload: unknown) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

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
      stream: true,
      system: PLANNER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(
      `Anthropic API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return anthropicSseToTextStream(res.body);
}

function anthropicSseToTextStream(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) continue;

          const raw = dataLine.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const evt = JSON.parse(raw) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (
              evt.type === 'content_block_delta' &&
              evt.delta?.type === 'text_delta' &&
              evt.delta.text
            ) {
              controller.enqueue(encoder.encode(evt.delta.text));
            }
          } catch {
            // Ignore non-JSON stream bookkeeping.
          }
        }
      },
      flush(controller) {
        const remaining = buffer.trim();
        if (!remaining) return;
        const dataLine = remaining
          .split('\n')
          .find((line) => line.startsWith('data: '));
        if (!dataLine) return;

        try {
          const evt = JSON.parse(dataLine.slice(6)) as {
            delta?: { text?: string };
          };
          if (evt.delta?.text) {
            controller.enqueue(encoder.encode(evt.delta.text));
          }
        } catch {
          // no-op
        }
      },
    }),
  );
}
