'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { suggestClientCsvColumnMapping } from '~/lib/ai/client-csv-map';
import {
  type ClientDuplicateMatch,
  type ClientImportDraft,
  type ExistingClientSnapshot,
  findClientDuplicate,
  inferClientType,
  validateClientImportDraft,
} from '~/lib/clients/client-import';
import {
  buildClientsExportCsv,
  extractCustomValues,
  normalizeCustomMapping,
  suggestCustomFieldMapping,
} from '~/lib/contacts/custom-fields-csv';
import {
  listContactCustomFields,
  setContactCustomValues,
} from '~/lib/contacts/custom-fields.service';
import {
  type CsvFieldMapping,
  applyCsvColumnMapping,
} from '~/lib/csv/rows-to-records';

import { createClientsService } from './clients.service';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

async function assertCanEditClients(accountId: string) {
  const service = createClientsService(getSupabaseServerClient());
  // listClients enforces membership; create uses clients.edit — probe via a no-op update path
  // by ensuring the user can list and that createClient permission gate would pass.
  await service.listClients({ accountId, page: 1, pageSize: 1 });
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { createTeamAccountsApi } = await import('@kit/team-accounts/api');
  const api = createTeamAccountsApi(client);
  const hasPermission = await api.hasPermission({
    userId: user.id,
    accountId,
    permission: 'clients.edit',
  });
  if (hasPermission) return;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = membership?.account_role;
  if (role === 'owner' || role === 'admin' || role === 'staff') return;
  throw new Error('You do not have permission to import clients');
}

const mappingSchema = z.record(z.string(), z.string());

const suggestSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  sampleRows: z.array(z.array(z.string())).max(10),
});

const previewSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: mappingSchema,
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: mappingSchema,
  /** Per rowIndex decision when a duplicate was detected. */
  duplicateActions: z.record(
    z.string(),
    z.enum(['keep', 'overwrite', 'create_new']),
  ),
});

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function recordToDraft(
  rowIndex: number,
  record: Record<string, string>,
): ClientImportDraft {
  const companyName = emptyToNull(record.company_name);
  const firstName = emptyToNull(record.first_name);
  const lastName = emptyToNull(record.last_name);
  const clientType = inferClientType({
    clientType: record.client_type,
    companyName,
    firstName,
  });

  const contactFirst = emptyToNull(record.contact_first_name);
  const contact =
    contactFirst ||
    emptyToNull(record.contact_email) ||
    emptyToNull(record.contact_phone)
      ? {
          firstName: contactFirst ?? firstName ?? 'Contact',
          lastName: emptyToNull(record.contact_last_name) ?? undefined,
          email: emptyToNull(record.contact_email) ?? undefined,
          phone: emptyToNull(record.contact_phone) ?? undefined,
          role: emptyToNull(record.contact_role) ?? undefined,
        }
      : null;

  const base = {
    rowIndex,
    clientType,
    companyName,
    firstName,
    lastName,
    email: emptyToNull(record.email),
    phone: emptyToNull(record.phone),
    addressLine1: emptyToNull(record.address_line_1),
    addressLine2: emptyToNull(record.address_line_2),
    city: emptyToNull(record.city),
    postcode: emptyToNull(record.postcode),
    country: emptyToNull(record.country),
    contact,
  };

  return {
    ...base,
    customFields: extractCustomValues(record),
    errors: validateClientImportDraft(base),
  };
}

export const suggestClientImportMappingAction = enhanceAction(
  async (input) => {
    await assertCanEditClients(input.accountId);

    const client = getSupabaseServerClient();
    const result = await suggestClientCsvColumnMapping({
      headers: input.headers,
      sampleRows: input.sampleRows,
      accountId: input.accountId,
      supabase: client,
    });
    const definitions = await listContactCustomFields(client, input.accountId);

    return {
      ...result,
      mapping: suggestCustomFieldMapping(
        input.headers,
        result.mapping,
        definitions,
      ),
    };
  },
  { schema: suggestSchema },
);

export const previewClientImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    await assertCanEditClients(input.accountId);

    const definitions = await listContactCustomFields(client, input.accountId);
    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      normalizeCustomMapping(input.mapping as CsvFieldMapping, definitions),
    );

    const drafts = records.map((record, index) => recordToDraft(index, record));

    const { data: existingRows, error } = await client
      .from('clients')
      .select(
        'id, display_name, email, company_name, first_name, last_name, client_type',
      )
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    const existing: ExistingClientSnapshot[] = (existingRows ?? []).map(
      (row) => ({
        id: row.id as string,
        displayName: String(row.display_name ?? ''),
        email: (row.email as string | null) ?? null,
        companyName: (row.company_name as string | null) ?? null,
        firstName: (row.first_name as string | null) ?? null,
        lastName: (row.last_name as string | null) ?? null,
        clientType: (row.client_type as string | null) ?? null,
      }),
    );

    const duplicates: ClientDuplicateMatch[] = [];
    for (const draft of drafts) {
      if (draft.errors.length) continue;
      const match = findClientDuplicate(draft, existing);
      if (match) duplicates.push(match);
    }

    return {
      drafts,
      duplicates,
      validCount: drafts.filter((d) => d.errors.length === 0).length,
      errorCount: drafts.filter((d) => d.errors.length > 0).length,
    };
  },
  { schema: previewSchema },
);

export const commitClientImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const service = createClientsService(client);
    await assertCanEditClients(input.accountId);

    const definitions = await listContactCustomFields(client, input.accountId);
    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      normalizeCustomMapping(input.mapping as CsvFieldMapping, definitions),
    );
    const drafts = records.map((record, index) => recordToDraft(index, record));

    const { data: existingRows, error } = await client
      .from('clients')
      .select(
        'id, display_name, email, company_name, first_name, last_name, client_type',
      )
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    const existing: ExistingClientSnapshot[] = (existingRows ?? []).map(
      (row) => ({
        id: row.id as string,
        displayName: String(row.display_name ?? ''),
        email: (row.email as string | null) ?? null,
        companyName: (row.company_name as string | null) ?? null,
        firstName: (row.first_name as string | null) ?? null,
        lastName: (row.last_name as string | null) ?? null,
        clientType: (row.client_type as string | null) ?? null,
      }),
    );

    const saveCustomValues = async (
      clientId: string,
      values: Record<string, string> | undefined,
    ) => {
      if (!values || Object.keys(values).length === 0) return;
      await setContactCustomValues(client, {
        accountId: input.accountId,
        clientId,
        values,
        definitions,
      });
    };

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const failed: Array<{ rowIndex: number; error: string }> = [];

    for (const draft of drafts) {
      try {
        if (draft.errors.length) {
          failed.push({
            rowIndex: draft.rowIndex,
            error: draft.errors.join('; '),
          });
          continue;
        }

        const match = findClientDuplicate(draft, existing);
        const action = match
          ? (input.duplicateActions[String(draft.rowIndex)] ?? 'keep')
          : 'create_new';

        if (action === 'keep') {
          skipped += 1;
          continue;
        }

        if (action === 'overwrite') {
          if (!match) {
            failed.push({
              rowIndex: draft.rowIndex,
              error: 'Overwrite requires a matched existing client',
            });
            continue;
          }

          const overwriteId = match.existing.id;
          await service.updateClient({
            accountId: input.accountId,
            clientId: match.existing.id,
            first_name: draft.firstName ?? undefined,
            last_name: draft.lastName,
            company_name: draft.companyName,
            email: draft.email,
            phone: draft.phone,
            address_line_1: draft.addressLine1,
            address_line_2: draft.addressLine2,
            city: draft.city,
            postcode: draft.postcode,
            country: draft.country,
          });
          await saveCustomValues(overwriteId, draft.customFields);
          updated += 1;
          continue;
        }

        const created = await service.createClient({
          accountId: input.accountId,
          client_type: draft.clientType,
          first_name: draft.firstName ?? undefined,
          last_name: draft.lastName ?? undefined,
          company_name: draft.companyName ?? undefined,
          email: draft.email ?? undefined,
          phone: draft.phone ?? undefined,
          address_line_1: draft.addressLine1 ?? undefined,
          address_line_2: draft.addressLine2 ?? undefined,
          city: draft.city ?? undefined,
          postcode: draft.postcode ?? undefined,
          country: draft.country ?? undefined,
          contact: draft.contact
            ? {
                firstName: draft.contact.firstName,
                lastName: draft.contact.lastName,
                email: draft.contact.email,
                phone: draft.contact.phone,
                role: draft.contact.role,
                isPrimary: true,
              }
            : undefined,
        });
        const createdId = (created as { id?: string } | null)?.id;
        if (createdId) {
          await saveCustomValues(createdId, draft.customFields);
        } else if (Object.keys(draft.customFields ?? {}).length > 0) {
          throw new Error(
            'Client created but custom fields could not be saved',
          );
        }
        imported += 1;
      } catch (err) {
        failed.push({
          rowIndex: draft.rowIndex,
          error: err instanceof Error ? err.message : 'Failed to import row',
        });
      }
    }

    const clientsPath = pathsConfig.app.accountClients.replace(
      '[account]',
      input.accountSlug,
    );
    revalidatePath(clientsPath, 'page');
    revalidatePath(`/home/${input.accountSlug}/clients`, 'page');

    return { imported, updated, skipped, failed };
  },
  { schema: commitSchema },
);

export const exportClientsCsvAction = enhanceAction(
  async (input) => {
    await assertCanEditClients(input.accountId);
    const client = getSupabaseServerClient();
    const definitions = await listContactCustomFields(client, input.accountId);

    const rows: Parameters<typeof buildClientsExportCsv>[0] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      // RLS limits this to workspaces the caller belongs to.
      const { data, error } = await fromTable(client, 'clients')
        .select(
          'client_type, company_name, first_name, last_name, email, phone, address_line_1, address_line_2, city, postcode, country, custom_fields',
        )
        .eq('account_id', input.accountId)
        .is('archived_at', null)
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as typeof rows;
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return {
      filename: 'ozer-clients-export.csv',
      csv: buildClientsExportCsv(rows, definitions),
      count: rows.length,
    };
  },
  { schema: z.object({ accountId: z.string().uuid() }) },
);
