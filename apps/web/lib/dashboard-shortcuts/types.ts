import { z } from 'zod';

export const StoredShortcutSchema = z.object({
  id: z.string().uuid(),
  catalogId: z.string().min(1),
  params: z.record(z.string(), z.string()).default({}),
  label: z.string().trim().max(120).optional(),
});

export type StoredShortcut = z.infer<typeof StoredShortcutSchema>;

export const StoredShortcutsArraySchema = z.array(StoredShortcutSchema).max(12);

export const MobileNavShortcutsArraySchema = z.array(StoredShortcutSchema).max(3);

export type ShortcutCatalogItem = {
  catalogId: string;
  label: string;
  description?: string;
  category: string;
  params: Record<string, string>;
  keywords: string[];
};

export type ResolvedShortcut = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

export type DefaultLandingType = 'personal' | 'workspace';

export type DefaultLandingPreference = {
  type: DefaultLandingType;
  workspaceSlug: string | null;
};

export function catalogItemKey(item: Pick<ShortcutCatalogItem, 'catalogId' | 'params'>) {
  return `${item.catalogId}::${JSON.stringify(item.params)}`;
}

export function parseStoredShortcuts(raw: unknown): StoredShortcut[] {
  const parsed = StoredShortcutsArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
