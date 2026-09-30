import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { listAccountCirculationSends } from '~/lib/commercial/circulation/circulate-listing';
import { resolveCirculationIdentity } from '~/lib/commercial/circulation/circulate-listing';
import { loadCirculationUsageSnapshot } from '~/lib/commercial/circulation/circulation-usage';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { listContactMatches } from '~/lib/commercial/circulation/contact-matches';

export async function loadCirculationWorkspaceData(
  client: SupabaseClient,
  accountId: string,
) {
  const circulation = createCommercialCirculationService(client);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null;

  const [settings, contacts, sends, identity, suspectedUnsubscribes] =
    await Promise.all([
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
      circulation.listSuspectedScannerUnsubscribes(accountId).catch((err) => {
        console.error(
          '[circulation] suspected unsubscribes',
          err instanceof Error ? err.message : err,
        );
        return [];
      }),
    ]);

  await Promise.all(
    contacts.map(async (contact) => {
      if (contact.consentStatus === 'unknown' || contact.publicAccessToken) {
        return;
      }
      contact.publicAccessToken = await circulation.ensurePublicAccessToken(
        accountId,
        contact.email,
      );
    }),
  );

  return {
    autoSendEnabled: settings.auto_send_enabled,
    minGapDays: settings.min_gap_days,
    rematchOnPriceDrop: settings.rematch_on_price_drop,
    rematchOnRelist: settings.rematch_on_relist,
    suspectedUnsubscribes,
    fromEmail: identity.fromEmail,
    fromName: identity.fromName,
    agencyName: identity.agencyName,
    usage: await loadCirculationUsageSnapshot(
      client,
      accountId,
      contacts.filter((contact) => contact.consentStatus === 'subscribed')
        .length,
    ),
    contacts: contacts.map((contact) => ({
      email: contact.email,
      clientId: contact.clientId,
      contactName: contact.contactName,
      companyName: contact.companyName,
      consentStatus: contact.consentStatus,
      autoSendEnabled: contact.autoSendEnabled,
      lastCirculatedAt: contact.lastCirculatedAt ?? contact.lastDigestSentAt,
      matchCount: contact.listings.length,
      publicAccessToken: contact.publicAccessToken,
    })),
    sends: sends.map((send) => ({
      id: send.id,
      subject: send.subject,
      sendTrigger: send.sendTrigger,
      sendKind: send.sendKind,
      recipientCount: send.recipientCount,
      deliveredCount: send.deliveredCount,
      openCount: send.openCount,
      clickCount: send.clickCount,
      bounceCount: send.bounceCount,
      complaintCount: send.complaintCount,
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
        deliveredAt: recipient.deliveredAt,
        openedAt: recipient.openedAt,
        openCount: recipient.openCount,
        clickedAt: recipient.clickedAt,
        clickCount: recipient.clickCount,
        bouncedAt: recipient.bouncedAt,
        bounceType: recipient.bounceType,
        complaintAt: recipient.complaintAt,
      })),
    })),
  };
}
