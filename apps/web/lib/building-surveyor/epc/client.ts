import 'server-only';

import { getGovUkEpcBearerToken } from './env';
import { parseEpcCertificate, parseEpcSearchHits } from './parse';
import {
  EpcApiError,
  type EpcApiErrorCode,
  type EpcCertificateSummary,
  type EpcSearchHit,
  GOV_UK_EPC_API_BASE_URL,
} from './types';

type SearchKind = 'domestic' | 'non-domestic';

export type EpcSearchQuery = {
  postcode?: string | null;
  address?: string | null;
  uprn?: string | null;
  pageSize?: number;
};

function messageForStatus(status: number, fallback: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'EPC lookup is unavailable right now.';
    case 404:
      return 'No energy certificate was found for this lookup.';
    case 429:
      return 'The GOV.UK EPC register is temporarily rate-limited. Try again in a few minutes.';
    default:
      return fallback;
  }
}

function asErrorStatus(status: number): EpcApiErrorCode {
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 429
  ) {
    return status;
  }
  return 500;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: unknown;
      errors?: Array<{ code?: string }>;
    };
    if (typeof json.error === 'string' && json.error.trim()) {
      return json.error.trim();
    }
    const first = json.errors?.[0]?.code;
    if (first?.trim()) return first.trim();
  } catch {
    // ignore parse failures
  }
  return messageForStatus(
    response.status,
    'The GOV.UK EPC API request failed.',
  );
}

export async function fetchGovUkEpc(
  path: string,
  query: Record<string, string | undefined>,
): Promise<unknown> {
  const token = getGovUkEpcBearerToken();
  if (!token) {
    throw new EpcApiError(401, 'EPC lookup is unavailable right now.');
  }

  const url = new URL(path, GOV_UK_EPC_API_BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    if (value?.trim()) url.searchParams.set(key, value.trim());
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    throw new EpcApiError(500, 'Could not reach the GOV.UK EPC API.');
  }

  if (!response.ok) {
    throw new EpcApiError(
      asErrorStatus(response.status),
      await readErrorMessage(response),
    );
  }

  return response.json();
}

export async function searchGovUkEpcCertificates(
  query: EpcSearchQuery,
  kind: SearchKind = 'domestic',
): Promise<EpcSearchHit[]> {
  const path =
    kind === 'domestic' ? '/api/domestic/search' : '/api/non-domestic/search';

  try {
    const payload = await fetchGovUkEpc(path, {
      postcode: query.postcode ?? undefined,
      address: query.address ?? undefined,
      uprn: query.uprn ?? undefined,
      page_size: String(Math.min(Math.max(query.pageSize ?? 50, 1), 100)),
      current_page: '1',
    });
    return parseEpcSearchHits(payload);
  } catch (error) {
    if (error instanceof EpcApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function fetchGovUkEpcCertificate(
  certificateNumber: string,
): Promise<{ summary: EpcCertificateSummary; raw: unknown }> {
  const payload = await fetchGovUkEpc('/api/certificate', {
    certificate_number: certificateNumber,
  });
  const parsed = parseEpcCertificate(payload, certificateNumber);
  if (!parsed?.certificateNumber) {
    throw new EpcApiError(404, 'The certificate response could not be read.');
  }
  return { summary: parsed, raw: payload };
}
