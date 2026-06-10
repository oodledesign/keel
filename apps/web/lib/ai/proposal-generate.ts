import 'server-only';

export type ProposalTranscript = {
  title: string;
  content: string;
};

export type ProposalGenerateParams = {
  recipientName: string;
  recipientCompany?: string | null;
  accountName: string;
  senderName: string;
  transcripts: ProposalTranscript[];
  referenceProposalHtml?: string | null;
  /** Total deal value in pounds (GBP), if known. */
  dealValue?: number | null;
};

const PROPOSAL_SYSTEM_PROMPT = `You write UK freelance proposals for creative and professional services.

Output ONLY the proposal body as simple HTML fragments — no <!DOCTYPE>, <html>, <head>, or <body> wrapper.

Use these sections in order, each as an <h2> heading followed by <p> and/or <ul>/<li> content:
1. The Goal
2. About You
3. The Format
4. What's Included
5. Packages (only if the engagement clearly offers tiered options; otherwise omit this section)
6. Add-ons
7. Payment Plan (list milestones with percentage splits that sum to 100%)
8. Next Steps

Rules:
- British English spelling and tone: professional, warm, direct.
- Base scope and pricing on the meeting transcripts and any reference proposal provided.
- Payment Plan must show clear milestone labels and percentages (e.g. "50% on signing, 50% on delivery").
- Use only h2, p, ul, li, strong, em — no tables, images, or inline styles.
- Do not invent facts not supported by the inputs; where details are missing, use sensible UK freelance defaults and keep language tentative ("typically", "we can agree").
- Do not wrap output in markdown fences.`;

function buildProposalUserPayload(params: ProposalGenerateParams) {
  const transcripts = params.transcripts
    .map(
      (t, i) =>
        `### Transcript ${i + 1}: ${t.title}\n${t.content.slice(0, 40_000)}`,
    )
    .join('\n\n');

  return {
    recipient_name: params.recipientName,
    recipient_company: params.recipientCompany?.trim() || null,
    workspace_name: params.accountName,
    sender_name: params.senderName,
    deal_value_gbp: params.dealValue ?? null,
    reference_proposal_html: params.referenceProposalHtml?.trim() || null,
    meeting_transcripts: transcripts || '(none provided)',
  };
}

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

  return { apiKey, model };
}

export async function streamProposalHtml(params: ProposalGenerateParams) {
  const { apiKey, model } = getAnthropicConfig();
  const payload = buildProposalUserPayload(params);

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
      system: PROPOSAL_SYSTEM_PROMPT,
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

/** Non-streaming variant for server actions and one-shot generation. */
export async function generateProposalHtml(
  params: ProposalGenerateParams,
): Promise<string> {
  const { apiKey, model } = getAnthropicConfig();
  const payload = buildProposalUserPayload(params);

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
      system: PROPOSAL_SYSTEM_PROMPT,
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
  const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) {
    throw new Error('Empty proposal HTML from Anthropic');
  }

  return stripMarkdownFences(text);
}

function stripMarkdownFences(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
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
