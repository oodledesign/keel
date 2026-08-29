import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { listAccountCirculationSends } from '~/lib/commercial/circulation/circulate-listing';
import { resolveCirculationIdentity } from '~/lib/commercial/circulation/circulate-listing';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { listContactMatches } from '~/lib/commercial/circulation/contact-matches';

export async function loadCirculationWorkspaceData(
  client: SupabaseClient,
  accountId: string,
) {
  const circulation = createCommercialCirculationService(client);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null;

  const [settings, contacts, sends, identity] = await Promise.all([
    circulation.getOrCreateSettings(accountId),
    listContactMatches(client, {
      accountId,
      siteUrl,
    }),
    listAccountCirculationSends(client, {
      accountId,
      limit: 25,
    }),
    resolveCirculationIdentity(client, accountId),
  ]);

  for (const contact of contacts) {
    if (contact.consentStatus === 'unknown' || contact.publicAccessToken) {
      continue;
    }
    contact.publicAccessToken = await circulation.ensurePublicAccessToken(
      accountId,
      contact.email,
    );
  }

  return {
    autoSendEnabled: settings.auto_send_enabled,
    fromEmail: identity.fromEmail,
    fromName: identity.fromName,
    agencyName: identity.agencyName,
    contacts: contacts.map((contact) => ({
      email: contact.email,
      contactName: contact.contactName,
      companyName: contact.companyName,
      consentStatus: contact.consentStatus,
      autoSendEnabled: contact.autoSendEnabled,
      lastDigestSentAt: contact.lastDigestSentAt,
      matchCount: contact.listings.length,
      publicAccessToken: contact.publicAccessToken,
    })),
    sends: sends.map((send) => ({
      id: send.id,
      subject: send.subject,
      sendTrigger: send.sendTrigger,
      sendKind: send.sendKind,
      recipientCount: send.recipientCount,
      createdAt: send.createdAt,
      fromEmail: send.fromEmail,
      fromName: send.fromName,
      recipients: send.recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        status: recipient.status,
        skipReason: recipient.skipReason,
        errorMessage: recipient.errorMessage,
        sesMessageId: recipient.sesMessageId,
      })),
    })),
  };
}
