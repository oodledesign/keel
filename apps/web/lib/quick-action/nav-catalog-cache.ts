import type { NavSearchItem } from '~/lib/quick-action/filter-nav-catalog';

type CatalogResponse = {
  items?: NavSearchItem[];
  error?: string;
};

let catalogPromise: Promise<NavSearchItem[]> | null = null;
let catalogCache: NavSearchItem[] | null = null;

export function getCachedNavCatalog(): NavSearchItem[] | null {
  return catalogCache;
}

export function prefetchNavCatalog(): Promise<NavSearchItem[]> {
  if (catalogCache) {
    return Promise.resolve(catalogCache);
  }

  if (!catalogPromise) {
    catalogPromise = fetch('/api/quick-action/nav-catalog')
      .then(async (res) => {
        const body = (await res.json()) as CatalogResponse;
        if (!res.ok) {
          throw new Error(body.error ?? 'Failed to load pages');
        }
        catalogCache = body.items ?? [];
        return catalogCache;
      })
      .catch((error) => {
        catalogPromise = null;
        throw error;
      });
  }

  return catalogPromise;
}

export function invalidateNavCatalogCache() {
  catalogCache = null;
  catalogPromise = null;
}
