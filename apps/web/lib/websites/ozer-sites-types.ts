/**
 * Ozer Sites domain types (Prompts F1 / F2).
 */
import type { Data } from '@puckeditor/core';

import type { WebsiteStyleTokens } from './style-tokens';

export type OzerSiteStatus = 'draft' | 'live' | 'offline';
export type OzerSitePageStatus = 'draft' | 'published';

/** Per-site client permission overrides (F2). */
export type OzerSiteSettings = {
  schemaVersion: '1.0';
  /** Allow portal clients to open the Puck editor. */
  portalEditEnabled: boolean;
  /** Loosen defaults: clients may delete sections. */
  clientCanDelete: boolean;
  /** Loosen defaults: clients may insert new block types. */
  clientCanInsert: boolean;
  /** Loosen defaults: clients may reorder via drag. */
  clientCanDrag: boolean;
};

export type OzerSiteRecord = {
  id: string;
  accountId: string;
  websiteId: string | null;
  name: string;
  primaryDomain: string | null;
  subdomain: string;
  status: OzerSiteStatus;
  themeTokens: WebsiteStyleTokens | Record<string, unknown>;
  settings: OzerSiteSettings;
  createdAt: string;
  updatedAt?: string;
};

export type OzerSitePageRecord = {
  id: string;
  siteId: string;
  accountId: string;
  slug: string;
  title: string;
  puckData: Data;
  status: OzerSitePageStatus;
  publishedData: Data | null;
  sourceHash: string | null;
  humanEditedAt: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

export type OzerSiteDomainRecord = {
  id: string;
  siteId: string;
  accountId: string;
  hostname: string;
  verifiedAt: string | null;
  isPrimary: boolean;
};

export type OzerSiteBundle = {
  site: OzerSiteRecord | null;
  pages: OzerSitePageRecord[];
  domains: OzerSiteDomainRecord[];
};

export type OzerSiteEditorRole = 'agency' | 'client';

export type OzerSitePuckPermissions = {
  delete: boolean;
  drag: boolean;
  duplicate: boolean;
  edit: boolean;
  insert: boolean;
};

export type PublishOzerSitesConflict = {
  pageId: string;
  slug: string;
  title: string;
  reason: 'human_edited';
  incomingHash: string;
  storedHash: string | null;
};

export type PublishOzerSitesResult =
  | {
      ok: true;
      siteId: string;
      subdomain: string;
      previewUrl: string;
      updatedPageIds: string[];
      createdPageIds: string[];
    }
  | {
      ok: false;
      conflicts: PublishOzerSitesConflict[];
    };

export function emptyOzerSiteSettings(): OzerSiteSettings {
  return {
    schemaVersion: '1.0',
    portalEditEnabled: false,
    clientCanDelete: false,
    clientCanInsert: false,
    clientCanDrag: false,
  };
}

export function normalizeOzerSiteSettings(raw: unknown): OzerSiteSettings {
  const base = emptyOzerSiteSettings();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  return {
    schemaVersion: '1.0',
    portalEditEnabled: Boolean(row.portalEditEnabled),
    clientCanDelete: Boolean(row.clientCanDelete),
    clientCanInsert: Boolean(row.clientCanInsert),
    clientCanDrag: Boolean(row.clientCanDrag),
  };
}

/** Agency = full control; client = text/image/props + duplicate unless overrides. */
export function resolveOzerSitePuckPermissions(
  role: OzerSiteEditorRole,
  settings: OzerSiteSettings,
): OzerSitePuckPermissions {
  if (role === 'agency') {
    return {
      delete: true,
      drag: true,
      duplicate: true,
      edit: true,
      insert: true,
    };
  }

  return {
    edit: true,
    duplicate: true,
    delete: settings.clientCanDelete,
    insert: settings.clientCanInsert,
    drag: settings.clientCanDrag,
  };
}

export function emptyPuckData(): Data {
  return { content: [], root: { props: {} } };
}

export function normalizePuckData(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') return emptyPuckData();
  const row = raw as Partial<Data>;
  return {
    content: Array.isArray(row.content) ? row.content : [],
    root: row.root && typeof row.root === 'object' ? row.root : { props: {} },
    zones: row.zones && typeof row.zones === 'object' ? row.zones : undefined,
  };
}

export const OZER_SITES_PREVIEW_ROOT =
  process.env.NEXT_PUBLIC_OZER_SITES_ROOT_DOMAIN?.trim() || 'sites.ozer.so';

export function ozerSitePreviewUrl(subdomain: string): string {
  return `https://${subdomain}.${OZER_SITES_PREVIEW_ROOT}`;
}
