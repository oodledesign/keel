import type { GscQueryMetricRow, GscSite } from './types';

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export async function listGscSites(accessToken: string): Promise<GscSite[]> {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(
      `GSC list sites failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
  };

  return (body.siteEntry ?? [])
    .map((entry) => ({
      siteUrl: entry.siteUrl?.trim() ?? '',
      permissionLevel: entry.permissionLevel ?? null,
    }))
    .filter((entry) => Boolean(entry.siteUrl));
}

export async function fetchGscSearchAnalytics(input: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  startRow?: number;
  rowLimit?: number;
}): Promise<GscQueryMetricRow[]> {
  const rowLimit = input.rowLimit ?? 25_000;
  const startRow = input.startRow ?? 0;
  const encodedSite = encodeURIComponent(input.siteUrl);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: ['query', 'date'],
        rowLimit,
        startRow,
        dataState: 'final',
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!res.ok) {
    throw new Error(
      `GSC searchAnalytics failed (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as { rows?: SearchAnalyticsRow[] };
  const rows: GscQueryMetricRow[] = [];

  for (const row of body.rows ?? []) {
    const query = row.keys?.[0]?.trim() ?? '';
    const metricDate = row.keys?.[1]?.trim() ?? '';
    if (!query || !metricDate) continue;

    rows.push({
      query,
      queryNormalized: query.toLowerCase().replace(/\s+/g, ' '),
      metricDate,
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
    });
  }

  return rows;
}

export async function fetchAllGscSearchAnalytics(input: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  maxRows?: number;
}): Promise<GscQueryMetricRow[]> {
  const maxRows = input.maxRows ?? 100_000;
  const pageSize = 25_000;
  const all: GscQueryMetricRow[] = [];
  let startRow = 0;

  while (startRow < maxRows) {
    const page = await fetchGscSearchAnalytics({
      ...input,
      startRow,
      rowLimit: Math.min(pageSize, maxRows - startRow),
    });

    all.push(...page);
    if (page.length < pageSize) break;
    startRow += pageSize;
  }

  return all;
}
