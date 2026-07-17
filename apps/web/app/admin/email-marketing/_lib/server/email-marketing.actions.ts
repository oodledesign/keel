'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import {
  EMAIL_RECIPIENT_LISTS,
  type EmailRecipientList,
  customListKey,
  isCustomListKey,
  parseCustomListId,
  parseManualEmails,
} from '~/lib/admin-email/campaigns';
import { DEFAULT_ANTHROPIC_MODEL } from '~/lib/ai/default-anthropic-model';
import { extractJsonObject } from '~/lib/ai/extract-json-object';

import {
  EMAIL_CONTACT_SOURCES,
  type EmailContactSource,
} from '../email-contact-constants';
import {
  applyEmailContactImportMapping,
  isEmailContactImportMappingComplete,
  isEmailContactImportRowImportable,
  parseImportedSubscribed,
} from '../email-contact-import-mapping';
import {
  EMAIL_CONTACT_IMPORT_FIELD_KEYS,
  type EmailContactImportFieldKey,
  ImportEmailContactsFromCsvSchema,
  SuggestEmailContactImportMappingsSchema,
} from '../email-contact-import.schema';
import {
  type ExcludableSystemList,
  isExcludableSystemList,
} from '../recipient-list-constants';

type DbClient = {
  from: (table: string) => any;
};

function adminClient() {
  return getSupabaseServerAdminClient() as unknown as DbClient;
}

function refreshEmailMarketing() {
  revalidatePath('/admin/email-marketing');
  revalidatePath('/admin/email-log');
}

function requireText(value: string | null | undefined, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function isRecipientList(value: string): value is EmailRecipientList {
  return (EMAIL_RECIPIENT_LISTS as readonly string[]).includes(value);
}

async function addContactToCustomList(listId: string, contactId: string) {
  const { error } = await adminClient()
    .from('email_contact_list_members')
    .upsert(
      { list_id: listId, contact_id: contactId },
      { onConflict: 'list_id,contact_id' },
    );

  if (error) throw new Error(error.message);
}

export async function saveCampaignDraft(input: {
  id?: string | null;
  title: string;
  subject: string;
  previewText?: string | null;
  htmlBody: string;
  plainTextBody?: string | null;
  templateId?: string | null;
  recipientList: string;
  contactListId?: string | null;
  manualRecipientEmails?: string[] | string | null;
  customRecipientIds?: string[] | null;
}) {
  const userId = await requireSuperAdmin();
  const admin = adminClient();
  const recipientList = input.recipientList;

  if (!isRecipientList(recipientList)) {
    throw new Error('Invalid recipient list');
  }

  const contactListId =
    recipientList === 'contact_list'
      ? input.contactListId?.trim() || null
      : null;

  if (recipientList === 'contact_list' && !contactListId) {
    throw new Error('Select a custom contact list');
  }

  const payload = {
    created_by: userId,
    title: requireText(input.title, 'Title'),
    subject: requireText(input.subject, 'Subject'),
    preview_text: input.previewText?.trim() || null,
    html_body: requireText(input.htmlBody, 'HTML body'),
    plain_text_body: input.plainTextBody?.trim() || null,
    template_id: input.templateId?.trim() || null,
    recipient_list: recipientList,
    contact_list_id: contactListId,
    manual_recipient_emails: parseManualEmails(input.manualRecipientEmails),
    custom_recipient_ids: input.customRecipientIds ?? null,
    status: 'draft',
  };

  const query = input.id
    ? admin
        .from('email_campaigns')
        .update(payload)
        .eq('id', input.id)
        .eq('status', 'draft')
        .select('id')
        .single()
    : admin.from('email_campaigns').insert(payload).select('id').single();

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  refreshEmailMarketing();
  return (data as { id: string }).id;
}

function normalizeContactSource(
  value: string | null | undefined,
): EmailContactSource {
  const source = value?.trim() || 'manual';
  if ((EMAIL_CONTACT_SOURCES as readonly string[]).includes(source)) {
    return source as EmailContactSource;
  }
  return 'manual';
}

export async function upsertContact(input: {
  id?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  trade?: string | null;
  source?: string | null;
  notes?: string | null;
  subscribed: boolean;
  customListId?: string | null;
  systemListKey?: ExcludableSystemList | null;
}) {
  const userId = await requireSuperAdmin();
  const admin = adminClient();
  const payload = {
    created_by: userId,
    first_name: requireText(input.firstName, 'First name'),
    last_name: requireText(input.lastName, 'Last name'),
    email: requireText(input.email, 'Email').toLowerCase(),
    trade: input.trade?.trim() || null,
    source: normalizeContactSource(input.source),
    notes: input.notes?.trim() || null,
    subscribed: input.subscribed,
  };

  let contactId = input.id?.trim() || null;

  if (contactId) {
    const { error } = await admin
      .from('email_contacts')
      .update(payload)
      .eq('id', contactId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from('email_contacts')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    contactId = (data as { id: string }).id;
  }

  if (input.customListId?.trim() && contactId) {
    await addContactToCustomList(input.customListId.trim(), contactId);
  }

  if (input.systemListKey && contactId) {
    await admin
      .from('email_contact_list_exclusions')
      .delete()
      .eq('contact_id', contactId)
      .eq('list_key', input.systemListKey);
  }

  refreshEmailMarketing();
}

export async function deleteContact(id: string) {
  await requireSuperAdmin();
  const { error } = await adminClient()
    .from('email_contacts')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  refreshEmailMarketing();
}

export async function removeContactFromRecipientList(input: {
  contactId: string;
  list: string;
}) {
  await requireSuperAdmin();
  const admin = adminClient();
  const contactId = input.contactId.trim();
  const list = input.list.trim();

  if (!contactId || !list) {
    throw new Error('Contact and list are required');
  }

  const customListId = parseCustomListId(list);
  if (customListId) {
    const { error } = await admin
      .from('email_contact_list_members')
      .delete()
      .eq('list_id', customListId)
      .eq('contact_id', contactId);
    if (error) throw new Error(error.message);
  } else if (isExcludableSystemList(list)) {
    const { error } = await admin.from('email_contact_list_exclusions').upsert(
      {
        contact_id: contactId,
        list_key: list as ExcludableSystemList,
      },
      { onConflict: 'contact_id,list_key' },
    );
    if (error) throw new Error(error.message);
  } else {
    throw new Error('This list does not support removing contacts');
  }

  refreshEmailMarketing();
}

export async function createContactList(input: {
  name: string;
  description?: string | null;
}) {
  const userId = await requireSuperAdmin();
  const admin = adminClient();
  const name = requireText(input.name, 'List name');

  const { data, error } = await admin
    .from('email_contact_lists')
    .insert({
      created_by: userId,
      name,
      description: input.description?.trim() || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  refreshEmailMarketing();
  return {
    id: (data as { id: string }).id,
    listKey: customListKey((data as { id: string }).id),
  };
}

export async function updateContactList(input: {
  id: string;
  name: string;
  description?: string | null;
}) {
  await requireSuperAdmin();
  const admin = adminClient();

  const { error } = await admin
    .from('email_contact_lists')
    .update({
      name: requireText(input.name, 'List name'),
      description: input.description?.trim() || null,
    })
    .eq('id', input.id);

  if (error) throw new Error(error.message);
  refreshEmailMarketing();
}

export async function deleteContactList(id: string) {
  await requireSuperAdmin();
  const admin = adminClient();

  const { error } = await admin
    .from('email_contact_lists')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  refreshEmailMarketing();
}

export async function setContactSubscribed(id: string, subscribed: boolean) {
  await requireSuperAdmin();
  const { error } = await adminClient()
    .from('email_contacts')
    .update({ subscribed })
    .eq('id', id);
  if (error) throw new Error(error.message);
  refreshEmailMarketing();
}

const ANTHROPIC_MODEL = DEFAULT_ANTHROPIC_MODEL;

const AiContactMappingRecordSchema = z.record(
  z.string(),
  z.union([z.enum(EMAIL_CONTACT_IMPORT_FIELD_KEYS), z.null()]),
);

export type EmailContactImportSkipReason =
  | 'missing_required_fields'
  | 'duplicate_email'
  | 'error';

export type ImportEmailContactsResult = {
  imported: number;
  skipped: Array<{
    rowNumber: number;
    reason: EmailContactImportSkipReason;
    detail?: string;
  }>;
};

export async function suggestContactImportMappings(
  input: z.infer<typeof SuggestEmailContactImportMappingsSchema>,
) {
  await requireSuperAdmin();

  const parsed = SuggestEmailContactImportMappingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, code: 'invalid' as const };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anthropicKey) {
    return { ok: false as const, code: 'unconfigured' as const };
  }

  const allowedList = EMAIL_CONTACT_IMPORT_FIELD_KEYS.join(', ');
  const system = `You map spreadsheet columns to Tradeways email marketing contact import fields.
Respond with a single JSON object only (no markdown, no commentary).
Keys must be exactly the CSV column header strings provided by the user.
Each value must be one of these exact field names: ${allowedList}
Or null if the column should not be imported or there is no good match.
Never invent field names. Never guess — use null when unsure.`;

  const userContent = JSON.stringify({
    headers: parsed.data.headers,
    rows: parsed.data.sampleRows,
  });

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
  } catch {
    return { ok: false as const, code: 'api' as const };
  }

  if (!response.ok) {
    return { ok: false as const, code: 'api' as const };
  }

  const body = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock =
    body.content?.find((chunk) => chunk.type === 'text')?.text ?? '';
  if (!textBlock) {
    return { ok: false as const, code: 'parse' as const };
  }

  let json: unknown;
  try {
    json = JSON.parse(extractJsonObject(textBlock));
  } catch {
    return { ok: false as const, code: 'parse' as const };
  }

  const validated = AiContactMappingRecordSchema.safeParse(json);
  if (!validated.success) {
    return { ok: false as const, code: 'parse' as const };
  }

  const suggestions: Record<string, EmailContactImportFieldKey | null> = {};
  for (const header of parsed.data.headers) {
    const value = validated.data[header];
    if (value === null || value === undefined) {
      suggestions[header] = null;
    } else if (
      (EMAIL_CONTACT_IMPORT_FIELD_KEYS as readonly string[]).includes(value)
    ) {
      suggestions[header] = value;
    } else {
      suggestions[header] = null;
    }
  }

  return { ok: true as const, suggestions };
}

export async function importContactsFromCsv(
  input: z.infer<typeof ImportEmailContactsFromCsvSchema>,
): Promise<ImportEmailContactsResult> {
  const userId = await requireSuperAdmin();
  const parsed = ImportEmailContactsFromCsvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Invalid import payload');
  }

  if (!isEmailContactImportMappingComplete(parsed.data.mapping)) {
    throw new Error('Column mapping is incomplete');
  }

  const admin = adminClient();
  const { data: existingContacts, error: existingError } = await admin
    .from('email_contacts')
    .select('email');

  if (existingError) {
    throw new Error(existingError.message);
  }

  const emailSet = new Set<string>();
  for (const row of existingContacts ?? []) {
    const email = (row as { email?: string | null }).email
      ?.trim()
      .toLowerCase();
    if (email) emailSet.add(email);
  }

  const result: ImportEmailContactsResult = {
    imported: 0,
    skipped: [],
  };

  const importSource = parsed.data.source ?? 'imported';

  const batch: Array<{
    created_by: string;
    first_name: string;
    last_name: string;
    email: string;
    trade: string | null;
    notes: string | null;
    source: string;
    subscribed: boolean;
  }> = [];

  for (let index = 0; index < parsed.data.rows.length; index++) {
    const row = parsed.data.rows[index]!;
    const rowNumber = index + 1;
    const mapped = applyEmailContactImportMapping(row, parsed.data.mapping);

    if (!isEmailContactImportRowImportable(mapped)) {
      result.skipped.push({
        rowNumber,
        reason: 'missing_required_fields',
      });
      continue;
    }

    const emailRaw = mapped.email!.trim();
    const emailNorm = emailRaw.toLowerCase();
    if (emailSet.has(emailNorm)) {
      result.skipped.push({
        rowNumber,
        reason: 'duplicate_email',
        detail: emailRaw,
      });
      continue;
    }

    batch.push({
      created_by: userId,
      first_name: mapped.first_name!.trim(),
      last_name: mapped.last_name!.trim(),
      email: emailNorm,
      trade: mapped.trade?.trim() || null,
      notes: mapped.notes?.trim() || null,
      source: importSource,
      subscribed: parseImportedSubscribed(mapped.subscribed),
    });
    emailSet.add(emailNorm);
  }

  if (batch.length > 0) {
    const { error } = await admin
      .from('email_contacts')
      .upsert(batch, { onConflict: 'email', ignoreDuplicates: true });

    if (error) throw new Error(error.message);
    result.imported = batch.length;

    const customListId = parsed.data.customListId?.trim();
    if (customListId) {
      const emails = batch.map((row) => row.email);
      const { data: importedContacts, error: lookupError } = await admin
        .from('email_contacts')
        .select('id, email')
        .in('email', emails);

      if (lookupError) throw new Error(lookupError.message);

      const members = ((importedContacts ?? []) as Array<{ id: string }>).map(
        (contact) => ({
          list_id: customListId,
          contact_id: contact.id,
        }),
      );

      if (members.length > 0) {
        const { error: memberError } = await admin
          .from('email_contact_list_members')
          .upsert(members, { onConflict: 'list_id,contact_id' });
        if (memberError) throw new Error(memberError.message);
      }
    }
  }

  refreshEmailMarketing();
  return result;
}

export async function removeUnsubscribe(id: string) {
  await requireSuperAdmin();
  const { error } = await adminClient()
    .from('email_unsubscribes')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  refreshEmailMarketing();
}

export async function duplicateCampaign(id: string) {
  const userId = await requireSuperAdmin();
  const admin = adminClient();

  const { data: source, error } = await admin
    .from('email_campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!source) throw new Error('Campaign not found');

  const payload = {
    created_by: userId,
    title: `${String(source.title).trim()} (copy)`,
    subject: source.subject,
    preview_text: source.preview_text,
    html_body: source.html_body,
    plain_text_body: source.plain_text_body,
    template_id: null,
    recipient_list: source.recipient_list,
    contact_list_id: source.contact_list_id ?? null,
    custom_recipient_ids: source.custom_recipient_ids,
    manual_recipient_emails: source.manual_recipient_emails,
    status: 'draft',
    sent_count: 0,
    total_recipients: 0,
    scheduled_at: null,
    sent_at: null,
  };

  const { data, error: insertError } = await admin
    .from('email_campaigns')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) throw new Error(insertError.message);

  refreshEmailMarketing();
  return (data as { id: string }).id;
}

/** Beta contact CSV import reuses contact import with source=beta. */
export async function suggestBetaUserImportMappings(
  input: z.infer<typeof SuggestEmailContactImportMappingsSchema>,
) {
  return suggestContactImportMappings(input);
}

export async function importBetaUsersFromCsv(
  input: z.infer<typeof ImportEmailContactsFromCsvSchema>,
) {
  return importContactsFromCsv({ ...input, source: 'beta' });
}
