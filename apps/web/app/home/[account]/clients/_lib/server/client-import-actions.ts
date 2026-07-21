'use server';

import { revalidatePath } from 'next/cache';

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
  type CsvFieldMapping,
  applyCsvColumnMapping,
} from '~/lib/csv/rows-to-records';

import { createClientsService } from './clients.service';

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
    errors: validateClientImportDraft(base),
  };
}

export const suggestClientImportMappingAction = enhanceAction(
  async (input) => {
    await assertCanEditClients(input.accountId);

    return suggestClientCsvColumnMapping({
      headers: input.headers,
      sampleRows: input.sampleRows,
    });
  },
  { schema: suggestSchema },
);

export const previewClientImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    await assertCanEditClients(input.accountId);

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
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

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
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
          updated += 1;
          continue;
        }

        await service.createClient({
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
