import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  gb: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  au: 'AU',
  australia: 'AU',
  ca: 'CA',
  canada: 'CA',
  ie: 'IE',
  ireland: 'IE',
  nz: 'NZ',
  'new zealand': 'NZ',
};

export function countryToTargetCountry(
  country: string | null | undefined,
): string {
  if (!country?.trim()) return 'GB';
  const trimmed = country.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return COUNTRY_ALIASES[trimmed.toLowerCase()] ?? 'GB';
}

export function clientDisplayName(client: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return (
    client.display_name?.trim() ||
    client.company_name?.trim() ||
    [client.first_name, client.last_name].filter(Boolean).join(' ').trim() ||
    'Unnamed client'
  );
}

export function normaliseDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '');
  value = value.split('/')[0] ?? value;
  return value || null;
}

export type RanklyClientImportOption = {
  clientId: string;
  label: string;
  suggestedName: string;
  domain: string | null;
  targetCountry: string;
  targetLanguage: string;
  hasExistingProject: boolean;
};

type ClientRow = {
  id: string;
  client_org_id?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
};

type WebsiteLike = {
  domain: string | null;
  clientOrgId?: string | null;
  linkedClientId?: string | null;
};

async function loadLinkedClientIds(
  client: SupabaseClient,
  accountId: string,
): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('client_id')
      .eq('account_id', accountId)
      .not('client_id', 'is', null);

    if (error) {
      console.error('[rankly] linked client projects', error.message);
      return new Set();
    }

    return new Set(
      (data ?? [])
        .map((row: { client_id: string | null }) => row.client_id)
        .filter(Boolean) as string[],
    );
  } catch (err) {
    console.error('[rankly] linked client projects', err);
    return new Set();
  }
}

function buildDomainMaps(
  clients: ClientRow[],
  websites: WebsiteLike[],
): {
  byClientId: Map<string, string>;
  byOrgId: Map<string, string>;
} {
  const byClientId = new Map<string, string>();
  const byOrgId = new Map<string, string>();

  for (const website of websites) {
    const domain = normaliseDomain(website.domain);
    if (!domain) continue;

    if (website.linkedClientId && !byClientId.has(website.linkedClientId)) {
      byClientId.set(website.linkedClientId, domain);
    }

    if (website.clientOrgId && !byOrgId.has(website.clientOrgId)) {
      byOrgId.set(website.clientOrgId, domain);
    }
  }

  return { byClientId, byOrgId };
}

export function mapClientsToImportOptions(
  clients: ClientRow[],
  websites: WebsiteLike[],
  linkedClientIds: Set<string>,
): RanklyClientImportOption[] {
  const { byClientId, byOrgId } = buildDomainMaps(clients, websites);

  return clients.map((row) => {
    const suggestedName = clientDisplayName(row);
    const domain =
      byClientId.get(row.id) ??
      (row.client_org_id ? byOrgId.get(row.client_org_id) : null) ??
      null;

    return {
      clientId: row.id,
      label: suggestedName,
      suggestedName,
      domain,
      targetCountry: countryToTargetCountry(row.country),
      targetLanguage: 'en',
      hasExistingProject: linkedClientIds.has(row.id),
    };
  });
}

export async function buildRanklyClientImportOptions(
  client: SupabaseClient,
  accountId: string,
  clients: ClientRow[],
  websites: WebsiteLike[] = [],
): Promise<RanklyClientImportOption[]> {
  if (!clients.length) return [];

  const linkedClientIds = await loadLinkedClientIds(client, accountId);
  return mapClientsToImportOptions(clients, websites, linkedClientIds);
}

export async function buildRanklyImportSeedForClient(
  client: SupabaseClient,
  accountId: string,
  clientId: string,
  clients: ClientRow[],
  websites: WebsiteLike[] = [],
): Promise<RanklyClientImportOption | null> {
  const options = await buildRanklyClientImportOptions(
    client,
    accountId,
    clients,
    websites,
  );
  return options.find((option) => option.clientId === clientId) ?? null;
}
