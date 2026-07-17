import 'server-only';

import { isFinanceRole } from './contact-roles';

export type RecipientPurpose =
  | 'invoice'
  | 'proposal'
  | 'contract'
  | 'notification';

export type ResolvedClientRecipient = {
  email: string | null;
  contactId: string | null;
  contactName: string | null;
  role: string | null;
  source: 'finance' | 'primary' | 'contact' | 'client' | 'fallback' | null;
};

type ContactLinkRow = {
  client_id: string;
  role?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
  contacts?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

function contactDisplayName(
  contact: ContactLinkRow['contacts'],
): string | null {
  if (!contact) return null;
  const composed = [contact.first_name, contact.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return composed || contact.full_name?.trim() || null;
}

function withEmail(row: ContactLinkRow): boolean {
  return Boolean(row.contacts?.email?.trim());
}

/**
 * Resolve who should receive invoices / proposals / contracts / notifications
 * for a CRM client.
 *
 * Priority:
 * 1. Finance contact (invoice purpose only)
 * 2. Primary contact
 * 3. Any linked contact with an email
 * 4. clients.email
 * 5. Optional fallback (e.g. previously stored sent_to_email)
 */
export async function resolveClientRecipientEmail(
  db: any,
  clientId: string,
  options?: {
    purpose?: RecipientPurpose;
    fallbackEmail?: string | null;
  },
): Promise<ResolvedClientRecipient> {
  const purpose = options?.purpose ?? 'notification';
  const empty: ResolvedClientRecipient = {
    email: null,
    contactId: null,
    contactName: null,
    role: null,
    source: null,
  };

  if (!clientId) return empty;

  const { data: links, error: linksError } = await db
    .from('client_contacts')
    .select(
      'client_id, role, is_primary, created_at, contacts ( id, email, full_name, first_name, last_name )',
    )
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (linksError) {
    console.error(
      '[resolveClientRecipientEmail] client_contacts query failed',
      {
        clientId,
        purpose,
        error: linksError,
      },
    );
  }

  const rows = (!linksError ? (links as ContactLinkRow[] | null) : null) ?? [];
  const withEmails = rows.filter(withEmail);

  if (purpose === 'invoice') {
    const finance = withEmails.find((row) => isFinanceRole(row.role));
    if (finance?.contacts?.email) {
      return {
        email: finance.contacts.email.trim(),
        contactId: finance.contacts.id ?? null,
        contactName: contactDisplayName(finance.contacts),
        role: finance.role ?? null,
        source: 'finance',
      };
    }
  }

  const primary = withEmails.find((row) => Boolean(row.is_primary));
  if (primary?.contacts?.email) {
    return {
      email: primary.contacts.email.trim(),
      contactId: primary.contacts.id ?? null,
      contactName: contactDisplayName(primary.contacts),
      role: primary.role ?? null,
      source: 'primary',
    };
  }

  const anyContact = withEmails[0];
  if (anyContact?.contacts?.email) {
    return {
      email: anyContact.contacts.email.trim(),
      contactId: anyContact.contacts.id ?? null,
      contactName: contactDisplayName(anyContact.contacts),
      role: anyContact.role ?? null,
      source: 'contact',
    };
  }

  const { data: client } = await db
    .from('clients')
    .select('email')
    .eq('id', clientId)
    .maybeSingle();

  const clientEmail =
    (client?.email as string | null | undefined)?.trim() || null;
  if (clientEmail) {
    return {
      email: clientEmail,
      contactId: null,
      contactName: null,
      role: null,
      source: 'client',
    };
  }

  const fallback = options?.fallbackEmail?.trim() || null;
  if (fallback) {
    return {
      email: fallback,
      contactId: null,
      contactName: null,
      role: null,
      source: 'fallback',
    };
  }

  return empty;
}
