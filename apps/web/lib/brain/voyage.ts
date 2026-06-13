import 'server-only';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const BATCH_SIZE = 128;
const MAX_RETRIES = 4;

export function isVoyageConfigured() {
  return Boolean(process.env.VOYAGE_API_KEY?.trim());
}

function getVoyageApiKey() {
  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY is not configured');
  }
  return apiKey;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = getVoyageApiKey();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    let attempt = 0;

    while (true) {
      const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'voyage-3',
          input: batch,
        }),
      });

      if (res.status === 429 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(500 * 2 ** attempt);
        continue;
      }

      if (!res.ok) {
        throw new Error(
          `Voyage API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
        );
      }

      const body = (await res.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };

      for (const row of body.data ?? []) {
        if (!row.embedding?.length) {
          throw new Error('Voyage returned an empty embedding');
        }
        results.push(row.embedding);
      }
      break;
    }
  }

  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  if (!embedding) throw new Error('Failed to embed query');
  return embedding;
}
