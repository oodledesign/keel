import 'server-only';

import type { WebflowFieldInfo } from './mapping';

const API = 'https://api.webflow.com/v2';
const MAX_RETRIES = 4;

export class WebflowApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'WebflowApiError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(
        (Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : 2 ** attempt) * 1000,
      );
      continue;
    }

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const json = (await response.json()) as { message?: string };
        if (json.message) detail = json.message;
      } catch {
        /* keep status text */
      }
      throw new WebflowApiError(
        response.status === 401
          ? 'Webflow rejected this API token. Check it and its CMS permissions.'
          : `Webflow: ${detail}`,
        response.status,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export type WebflowSite = { id: string; displayName: string };
export type WebflowCollection = { id: string; displayName: string };

export async function listWebflowSites(token: string): Promise<WebflowSite[]> {
  const json = await request<{
    sites?: Array<{ id: string; displayName?: string; shortName?: string }>;
  }>(token, '/sites');
  return (json.sites ?? []).map((site) => ({
    id: site.id,
    displayName: site.displayName ?? site.shortName ?? site.id,
  }));
}

export async function listWebflowCollections(
  token: string,
  siteId: string,
): Promise<WebflowCollection[]> {
  const json = await request<{
    collections?: Array<{ id: string; displayName?: string; slug?: string }>;
  }>(token, `/sites/${encodeURIComponent(siteId)}/collections`);
  return (json.collections ?? []).map((collection) => ({
    id: collection.id,
    displayName: collection.displayName ?? collection.slug ?? collection.id,
  }));
}

export async function getWebflowCollectionFields(
  token: string,
  collectionId: string,
): Promise<WebflowFieldInfo[]> {
  const json = await request<{
    fields?: Array<{
      slug: string;
      displayName?: string;
      type: string;
      isRequired?: boolean;
      isEditable?: boolean;
    }>;
  }>(token, `/collections/${encodeURIComponent(collectionId)}`);
  return (json.fields ?? [])
    .filter((field) => field.isEditable !== false)
    .map((field) => ({
      slug: field.slug,
      displayName: field.displayName ?? field.slug,
      type: field.type,
      isRequired: Boolean(field.isRequired),
    }));
}

export async function createWebflowItem(
  token: string,
  collectionId: string,
  fieldData: Record<string, unknown>,
): Promise<string> {
  const json = await request<{ id: string }>(
    token,
    `/collections/${encodeURIComponent(collectionId)}/items`,
    { method: 'POST', body: { isArchived: false, isDraft: false, fieldData } },
  );
  return json.id;
}

export async function updateWebflowItem(
  token: string,
  collectionId: string,
  itemId: string,
  fieldData: Record<string, unknown>,
) {
  await request(
    token,
    `/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: { isArchived: false, isDraft: false, fieldData } },
  );
}

/**
 * Deletes the staged item; with `live` also removes the published copy first.
 * Returns false when the item is already gone.
 */
export async function deleteWebflowItem(
  token: string,
  collectionId: string,
  itemId: string,
  options: { live?: boolean } = {},
): Promise<boolean> {
  const base = `/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`;
  if (options.live) {
    try {
      await request(token, `${base}/live`, { method: 'DELETE' });
    } catch (error) {
      if (!(error instanceof WebflowApiError && error.status === 404)) {
        throw error;
      }
    }
  }
  try {
    await request(token, base, { method: 'DELETE' });
    return true;
  } catch (error) {
    if (error instanceof WebflowApiError && error.status === 404) return false;
    throw error;
  }
}

/** Publish staged items (max 100 per request). */
export async function publishWebflowItems(
  token: string,
  collectionId: string,
  itemIds: string[],
) {
  for (let offset = 0; offset < itemIds.length; offset += 100) {
    await request(
      token,
      `/collections/${encodeURIComponent(collectionId)}/items/publish`,
      {
        method: 'POST',
        body: { itemIds: itemIds.slice(offset, offset + 100) },
      },
    );
  }
}
