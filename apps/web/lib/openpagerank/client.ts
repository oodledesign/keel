import 'server-only';

// Open PageRank API — free, no usage costs
// Docs: https://www.domcop.com/openpagerank/documentation

const OPR_API_KEY = process.env.OPENPAGERANK_API_KEY ?? '';
const OPR_BASE = 'https://openpagerank.com/api/v1.0';

export type OprResult = {
  domain: string;
  page_rank_integer: number;
  page_rank_decimal: number;
  rank: string | null;
  error: string;
};

export type OprResponse = {
  status_code: number;
  response: OprResult[];
  last_updated: string;
};

export function normaliseOprDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

function emptyResult(domain: string): OprResult {
  return {
    domain,
    page_rank_integer: 0,
    page_rank_decimal: 0,
    rank: null,
    error: 'not_found',
  };
}

export async function getPageRanks(
  domains: string[],
): Promise<Record<string, OprResult>> {
  if (!domains.length) return {};

  const unique = [...new Set(domains.map(normaliseOprDomain))].filter(Boolean);
  const results: Record<string, OprResult> = {};

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);

    try {
      const params = new URLSearchParams();
      batch.forEach((domain) => params.append('domains[]', domain));

      const res = await fetch(`${OPR_BASE}/getPageRank?${params.toString()}`, {
        headers: {
          'API-OPR': OPR_API_KEY,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`OPR API error: ${res.status}`);
        batch.forEach((domain) => {
          results[domain] = emptyResult(domain);
        });
        continue;
      }

      const data = (await res.json()) as OprResponse;

      for (const item of data.response ?? []) {
        results[normaliseOprDomain(item.domain)] = item;
      }

      for (const domain of batch) {
        if (!results[domain]) {
          results[domain] = emptyResult(domain);
        }
      }
    } catch (err) {
      console.error('OPR fetch failed:', err);
      batch.forEach((domain) => {
        results[domain] = emptyResult(domain);
      });
    }
  }

  return results;
}

export async function getPageRank(domain: string): Promise<OprResult> {
  const results = await getPageRanks([domain]);
  return results[normaliseOprDomain(domain)] ?? emptyResult(domain);
}
