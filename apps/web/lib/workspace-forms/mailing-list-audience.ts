/**
 * Campaigns mailing-list forms can target one or more audience lists.
 * Subscriber-facing picks only include public lists (PR #190).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAILING_LIST_AUDIENCE_KEY = 'audience_lists';

export type FormAudienceListOption = {
  id: string;
  name: string;
  isPublic: boolean;
};

export function normalizeAudienceListIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function audienceListIdsFromFormInput(input: {
  audienceListId?: string | null;
  audienceListIds?: string[] | null;
}): string[] {
  const fromArray = normalizeAudienceListIds(input.audienceListIds);
  if (fromArray.length > 0) return fromArray;
  const single = input.audienceListId?.trim();
  return single && UUID_RE.test(single) ? [single] : [];
}

export function parseAudienceListIdsFromValues(
  values: Record<string, unknown>,
): string[] {
  const raw = values[MAILING_LIST_AUDIENCE_KEY];
  if (Array.isArray(raw)) return normalizeAudienceListIds(raw);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return normalizeAudienceListIds(raw.split(/[\s,;]+/));
}

export function subscriberPickableAudienceLists(
  lists: FormAudienceListOption[],
): FormAudienceListOption[] {
  return lists.filter((list) => list.isPublic);
}

/**
 * Decide which configured lists a signup should join.
 *
 * - 0–1 configured lists: auto-join those lists.
 * - 2+ lists: subscriber may pick a public subset. Private targeted lists
 *   always join. An empty pick joins every configured list.
 */
export function resolveMailingSignupListIds(input: {
  configured: Array<Pick<FormAudienceListOption, 'id' | 'isPublic'>>;
  pickedIds?: string[] | null;
}): string[] {
  const configuredIds = normalizeAudienceListIds(
    input.configured.map((list) => list.id),
  );
  if (configuredIds.length <= 1) return configuredIds;

  const publicIds = new Set(
    input.configured.filter((list) => list.isPublic).map((list) => list.id),
  );
  const privateIds = configuredIds.filter((id) => !publicIds.has(id));
  const picked = normalizeAudienceListIds(input.pickedIds).filter((id) =>
    publicIds.has(id),
  );

  if (publicIds.size <= 1 || picked.length === 0) {
    return configuredIds;
  }

  return [...privateIds, ...picked];
}
