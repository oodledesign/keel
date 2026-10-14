import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { findClientByEmailThenPhone } from '~/lib/clients/client-import';

import type { IgContactRow } from '../types';
import { normaliseEmail, normaliseUkPhone } from './collect-validate';

type ClientMatchRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

const CLIENT_SCAN_LIMIT = 5000;

function contactLabel(contact: IgContactRow) {
  return (
    contact.display_name?.trim() ||
    (contact.username ? `@${contact.username}` : 'Instagram contact')
  );
}

function splitName(name: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  return {
    first: parts[0]!,
    last: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

/**
 * Link an Instagram contact to a CRM client, creating one when no existing
 * client matches by email, then phone. Optionally opens a lead and a
 * follow-up task. Returns null when there is nothing to match on yet.
 */
export async function syncIgContactToClient(
  admin: SupabaseClient,
  params: {
    contact: IgContactRow;
    createDeal: boolean;
    dealStage?: string;
    createTask: boolean;
  },
): Promise<{ clientId: string; created: boolean } | null> {
  const { contact } = params;
  const email = contact.custom_fields.email
    ? normaliseEmail(contact.custom_fields.email)
    : null;
  const phone = contact.custom_fields.phone
    ? normaliseUkPhone(contact.custom_fields.phone)
    : null;
  if (!email && !phone && !contact.linked_client_id) return null;

  let clientId = contact.linked_client_id;
  let created = false;

  if (clientId) {
    const { data: linked } = await admin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('account_id', contact.account_id)
      .maybeSingle();
    if (!linked) clientId = null;
  }

  if (!clientId) {
    const { data: candidates, error } = await admin
      .from('clients')
      .select('id, email, phone')
      .eq('account_id', contact.account_id)
      .is('archived_at', null)
      .or('email.not.is.null,phone.not.is.null')
      .limit(CLIENT_SCAN_LIMIT);
    if (error) throw new Error(error.message);

    const match = findClientByEmailThenPhone(
      { email, phone },
      (candidates ?? []) as ClientMatchRow[],
      normaliseUkPhone,
    );

    if (match) {
      clientId = match.client.id;
      const fill: Record<string, string> = {};
      if (email && !match.client.email) fill.email = email;
      if (phone && !match.client.phone) fill.phone = phone;
      if (Object.keys(fill).length > 0) {
        await admin.from('clients').update(fill).eq('id', clientId);
      }
    } else {
      const name = splitName(contact.display_name);
      const { data: inserted, error: insertError } = await admin
        .from('clients')
        .insert({
          account_id: contact.account_id,
          client_type: 'individual',
          display_name: contactLabel(contact),
          first_name: name.first ?? contact.username ?? null,
          last_name: name.last,
          email,
          phone,
          custom_fields: contact.username
            ? { instagram_username: contact.username }
            : {},
        })
        .select('id')
        .single();
      if (insertError || !inserted) {
        throw new Error(insertError?.message ?? 'Could not create client');
      }
      clientId = (inserted as { id: string }).id;
      created = true;
    }

    await admin
      .from('ig_contacts')
      .update({ linked_client_id: clientId })
      .eq('id', contact.id);
  }

  const label = contactLabel(contact);

  if (params.createDeal) {
    const dealName = `Instagram: ${label}`;
    const { count } = await admin
      .from('pipeline_deals')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', contact.account_id)
      .eq('client_id', clientId)
      .eq('name', dealName)
      .is('archived_at', null);

    if (!count) {
      const { error: dealError } = await admin.from('pipeline_deals').insert({
        account_id: contact.account_id,
        client_id: clientId,
        name: dealName,
        contact_name: label,
        contact_email: email,
        contact_phone: phone,
        company_name: label,
        value: 0,
        stage: params.dealStage || 'lead',
        source: 'social',
      });
      if (dealError) {
        console.error('[ig-crm] deal insert failed', {
          contactId: contact.id,
          code: dealError.code,
        });
      }
    }
  }

  if (params.createTask) {
    const { error: taskError } = await admin.from('tasks').insert({
      account_id: contact.account_id,
      client_id: clientId,
      title: `Follow up Instagram lead ${label}`,
      notes: 'Created by an Instagram automation.',
      status: 'todo',
      priority: 'medium',
    });
    if (taskError) {
      console.error('[ig-crm] task insert failed', {
        contactId: contact.id,
        code: taskError.code,
      });
    }
  }

  return { clientId: clientId!, created };
}
