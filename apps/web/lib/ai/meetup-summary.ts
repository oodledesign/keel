import 'server-only';

export async function summarizeMeetupTranscript(
  transcript: string,
  meetupTitle: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

  const system = `You summarize home group / community meetup notes for leaders.
Write a clear, warm summary in markdown with sections: Highlights, Discussion, Prayer & pastoral care, Action items, Next time.
Keep it concise (under 400 words). Do not invent facts not present in the transcript.`;

  const userContent = `Meetup title: ${meetupTitle}

Transcript / raw notes:
---
${transcript.slice(0, 80_000)}
---`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: userContent }],
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
  const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) {
    throw new Error('Empty summary from Anthropic');
  }
  return text;
}
