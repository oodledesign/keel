import 'server-only';

const DEFAULT_API_URL = 'https://api.firecrawl.dev/v1';

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    html?: string;
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      ogImage?: string;
    };
  };
  error?: string;
};

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

export async function fetchPageHtmlWithFirecrawl(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const apiUrl = process.env.FIRECRAWL_API_URL?.trim() || DEFAULT_API_URL;

  const res = await fetch(`${apiUrl}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['html'],
      onlyMainContent: false,
      timeout: 20000,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    console.warn(
      `[firecrawl] scrape failed for ${url}: HTTP ${res.status}`,
    );
    return null;
  }

  const json = (await res.json()) as FirecrawlScrapeResponse;
  if (!json.success || !json.data?.html) {
    console.warn(
      `[firecrawl] scrape empty for ${url}: ${json.error ?? 'no html'}`,
    );
    return null;
  }

  return json.data.html;
}
