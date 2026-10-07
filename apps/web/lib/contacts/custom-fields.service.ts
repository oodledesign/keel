import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CONTACT_CUSTOM_FIELD_MAX,
  type ContactCustomFieldDefinition,
  type ContactCustomFieldType,
  type ContactCustomFieldValues,
  isValidContactFieldKey,
  sanitizeContactCustomValues,
  uniqueContactFieldKey,
} from './custom-fields';

/** Tables not yet in generated Database types. */
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

type DefinitionRow = {
  id: string;
  key: string;
  label: string;
  field_type: ContactCustomFieldType;
  options: unknown;
  position: number;
};

function mapDefinition(row: DefinitionRow): ContactCustomFieldDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    fieldType: row.field_type,
    options: Array.isArray(row.options)
      ? row.options.filter((item): item is string => typeof item === 'string')
      : [],
    position: row.position,
  };
}

export async function listContactCustomFields(
  client: SupabaseClient,
  accountId: string,
): Promise<ContactCustomFieldDefinition[]> {
  const { data, error } = await fromTable(client, 'contact_custom_fields')
    .select('id, key, label, field_type, options, position')
    .eq('account_id', accountId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  // Table missing (migration not applied yet) must not break contact pages.
  if (error) return [];
  return ((data ?? []) as DefinitionRow[]).map(mapDefinition);
}

export async function createContactCustomField(
  client: SupabaseClient,
  input: {
    accountId: string;
    label: string;
    fieldType: ContactCustomFieldType;
    options?: string[];
    key?: string;
  },
): Promise<ContactCustomFieldDefinition> {
  const existing = await listContactCustomFields(client, input.accountId);
  if (existing.length >= CONTACT_CUSTOM_FIELD_MAX) {
    throw new Error(
      `You can have up to ${CONTACT_CUSTOM_FIELD_MAX} custom contact fields.`,
    );
  }

  const label = input.label.trim();
  if (!label) throw new Error('Give the field a name.');

  const key =
    input.key && isValidContactFieldKey(input.key)
      ? input.key
      : uniqueContactFieldKey(
          label,
          existing.map((field) => field.key),
        );
  if (existing.some((field) => field.key === key)) {
    return existing.find((field) => field.key === key)!;
  }

  const options =
    input.fieldType === 'select'
      ? [
          ...new Set(
            (input.options ?? []).map((o) => o.trim()).filter(Boolean),
          ),
        ].slice(0, 40)
      : [];

  const { data, error } = await fromTable(client, 'contact_custom_fields')
    .insert({
      account_id: input.accountId,
      key,
      label: label.slice(0, 80),
      field_type: input.fieldType,
      options,
      position: existing.length,
    })
    .select('id, key, label, field_type, options, position')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create the field.');
  }
  return mapDefinition(data as DefinitionRow);
}

export async function updateContactCustomField(
  client: SupabaseClient,
  input: {
    accountId: string;
    id: string;
    label: string;
    options?: string[];
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    label: input.label.trim().slice(0, 80),
    updated_at: new Date().toISOString(),
  };
  if (input.options) {
    patch.options = [
      ...new Set(input.options.map((o) => o.trim()).filter(Boolean)),
    ].slice(0, 40);
  }
  const { error } = await fromTable(client, 'contact_custom_fields')
    .update(patch)
    .eq('id', input.id)
    .eq('account_id', input.accountId);
  if (error) throw new Error(error.message);
}

export async function deleteContactCustomField(
  client: SupabaseClient,
  input: { accountId: string; id: string },
): Promise<void> {
  const { error } = await fromTable(client, 'contact_custom_fields')
    .delete()
    .eq('id', input.id)
    .eq('account_id', input.accountId);
  if (error) throw new Error(error.message);
  // Orphaned values stay on contacts but are ignored (and re-appear if the
  // same key is created again); no bulk rewrite needed.
}

export async function getContactCustomValues(
  client: SupabaseClient,
  input: { accountId: string; clientId: string },
): Promise<ContactCustomFieldValues> {
  const { data, error } = await fromTable(client, 'clients')
    .select('custom_fields')
    .eq('id', input.clientId)
    .eq('account_id', input.accountId)
    .maybeSingle();
  if (error || !data) return {};
  const raw = (data as { custom_fields?: unknown }).custom_fields;
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as ContactCustomFieldValues)
    : {};
}

/**
 * Merge values into a contact. `null` clears a key. Unknown keys are dropped.
 */
export async function setContactCustomValues(
  client: SupabaseClient,
  input: {
    accountId: string;
    clientId: string;
    values: Record<string, unknown>;
    definitions?: ContactCustomFieldDefinition[];
  },
): Promise<ContactCustomFieldValues> {
  const definitions =
    input.definitions ??
    (await listContactCustomFields(client, input.accountId));
  const known = new Set(definitions.map((definition) => definition.key));

  const clean = sanitizeContactCustomValues(definitions, input.values);
  const clearKeys = Object.entries(input.values)
    .filter(
      ([key, value]) => known.has(key) && (value === null || value === ''),
    )
    .map(([key]) => key);

  const current = await getContactCustomValues(client, input);
  const next: ContactCustomFieldValues = { ...current, ...clean };
  for (const key of clearKeys) delete next[key];

  const { error } = await fromTable(client, 'clients')
    .update({ custom_fields: next, updated_at: new Date().toISOString() })
    .eq('id', input.clientId)
    .eq('account_id', input.accountId);
  if (error) throw new Error(error.message);
  return next;
}

/**
 * Custom values for contacts looked up by (lowercase) email, e.g. campaign
 * recipients. Contacts with no custom values are omitted.
 */
export async function loadCustomValuesByEmail(
  client: SupabaseClient,
  accountId: string,
  emails: string[],
): Promise<Map<string, ContactCustomFieldValues>> {
  const map = new Map<string, ContactCustomFieldValues>();
  const unique = [
    ...new Set(emails.map((email) => email.trim().toLowerCase())),
  ].filter(Boolean);

  for (let offset = 0; offset < unique.length; offset += 200) {
    const chunk = unique.slice(offset, offset + 200);
    const { data, error } = await fromTable(client, 'clients')
      .select('email, custom_fields')
      .eq('account_id', accountId)
      .in('email', chunk);
    // Never block sending on this lookup (e.g. migration pending), but make
    // failures observable and keep the chunks that did load.
    if (error) {
      console.error('[custom-fields] value lookup failed', error.message);
      continue;
    }

    for (const row of (data ?? []) as Array<{
      email: string | null;
      custom_fields: unknown;
    }>) {
      const values = row.custom_fields;
      if (
        row.email &&
        values &&
        typeof values === 'object' &&
        !Array.isArray(values) &&
        Object.keys(values).length > 0
      ) {
        map.set(row.email.toLowerCase(), values as ContactCustomFieldValues);
      }
    }
  }
  return map;
}
