import 'server-only';

import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';

import type { BacklinkResult, BacklinkSummary, ReferringDomain } from './types';

const client = new AthenaClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

const RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET ?? '';
const DATABASE = process.env.ATHENA_DATABASE ?? 'ccindex';

const EMPTY_SUMMARY: BacklinkSummary = {
  referring_domains: 0,
  total_backlinks: 0,
  top_referring_domains: [],
  sample_backlinks: [],
};

function isAthenaConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    RESULTS_BUCKET,
  );
}

export function isCommonCrawlBacklinksEnabled(): boolean {
  return isAthenaConfigured();
}

export async function getBacklinkSummary(
  targetDomain: string,
  limit = 500,
): Promise<BacklinkSummary> {
  if (!isAthenaConfigured()) {
    return EMPTY_SUMMARY;
  }

  const sanitised = sanitiseDomain(targetDomain);

  const domainQuery = `
    SELECT
      src_domain,
      COUNT(*) as link_count
    FROM cc_link_graph
    WHERE tgt_domain = '${sanitised}'
      AND src_domain != '${sanitised}'
    GROUP BY src_domain
    ORDER BY link_count DESC
    LIMIT 50
  `;

  const linksQuery = `
    SELECT src_domain, src_url, tgt_url
    FROM cc_link_graph
    WHERE tgt_domain = '${sanitised}'
      AND src_domain != '${sanitised}'
    LIMIT ${limit}
  `;

  try {
    const [domainResults, linkResults] = await Promise.all([
      runAthenaQuery(domainQuery),
      runAthenaQuery(linksQuery),
    ]);

    const topReferringDomains: ReferringDomain[] = domainResults
      .map((row) => ({
        domain: row[0] ?? '',
        link_count: parseInt(row[1] ?? '0', 10),
      }))
      .filter((row) => row.domain);

    const sampleBacklinks: BacklinkResult[] = linkResults.map((row) => ({
      src_domain: row[0] ?? '',
      src_url: row[1] ?? '',
      tgt_url: row[2] ?? '',
    }));

    return {
      referring_domains: topReferringDomains.length,
      total_backlinks: sampleBacklinks.length,
      top_referring_domains: topReferringDomains,
      sample_backlinks: sampleBacklinks,
    };
  } catch (err) {
    console.error('[commoncrawl] getBacklinkSummary failed:', err);
    return EMPTY_SUMMARY;
  }
}

export async function compareBacklinks(
  domains: string[],
): Promise<Record<string, number>> {
  if (!isAthenaConfigured() || !domains.length) {
    return {};
  }

  const sanitised = domains.map(sanitiseDomain).filter(Boolean);
  if (!sanitised.length) return {};

  const inClause = sanitised.map((d) => `'${d}'`).join(', ');

  const query = `
    SELECT tgt_domain, COUNT(DISTINCT src_domain) as referring_domains
    FROM cc_link_graph
    WHERE tgt_domain IN (${inClause})
    GROUP BY tgt_domain
  `;

  try {
    const results = await runAthenaQuery(query);
    const map: Record<string, number> = {};

    for (const row of results) {
      if (row[0]) {
        map[row[0]] = parseInt(row[1] ?? '0', 10);
      }
    }

    return map;
  } catch (err) {
    console.error('[commoncrawl] compareBacklinks failed:', err);
    return {};
  }
}

export async function findUnlinkedMentions(
  targetDomain: string,
  brandName: string,
): Promise<string[]> {
  if (!isAthenaConfigured()) {
    return [];
  }

  const query = `
    SELECT DISTINCT src_domain
    FROM ccindex
    WHERE url LIKE '%${sanitiseBrandName(brandName)}%'
      AND url_host_registered_domain != '${sanitiseDomain(targetDomain)}'
    LIMIT 100
  `;

  try {
    const results = await runAthenaQuery(query);
    return results.map((row) => row[0]).filter(Boolean) as string[];
  } catch (err) {
    console.error('[commoncrawl] findUnlinkedMentions failed:', err);
    return [];
  }
}

async function runAthenaQuery(sql: string): Promise<string[][]> {
  const start = await client.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: DATABASE },
      ResultConfiguration: { OutputLocation: RESULTS_BUCKET },
    }),
  );

  const executionId = start.QueryExecutionId;
  if (!executionId) {
    throw new Error('Athena: no execution ID returned');
  }

  await pollUntilComplete(executionId, 60);

  const results = await client.send(
    new GetQueryResultsCommand({
      QueryExecutionId: executionId,
    }),
  );

  const rows = results.ResultSet?.Rows ?? [];
  return rows
    .slice(1)
    .map((row) => (row.Data ?? []).map((cell) => cell.VarCharValue ?? ''));
}

async function pollUntilComplete(
  executionId: string,
  maxSeconds: number,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < maxSeconds * 1000) {
    await delay(3000);

    const status = await client.send(
      new GetQueryExecutionCommand({
        QueryExecutionId: executionId,
      }),
    );

    const state = status.QueryExecution?.Status?.State;
    if (state === 'SUCCEEDED') return;

    if (state === 'FAILED' || state === 'CANCELLED') {
      const reason = status.QueryExecution?.Status?.StateChangeReason;
      throw new Error(`Athena query ${state}: ${reason}`);
    }
  }

  throw new Error('Athena query timed out after 60 seconds');
}

function sanitiseDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .replace(/'/g, "''");
}

function sanitiseBrandName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/'/g, "''");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
