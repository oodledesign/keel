export type MessageNotifyMember = {
  userId: string;
  email: string | null;
};

export type MessageNotifyContact = {
  userId: string | null;
  email: string | null;
};

export type MessageNotifyClient = {
  userId: string | null;
  email: string | null;
};

export type MessageNotifyRecipients = {
  inAppUserIds: string[];
  emails: string[];
};

function addNotifyEmail(
  emails: Set<string>,
  email: string | null | undefined,
  senderEmail: string | null,
) {
  const normalized = email?.trim().toLowerCase();
  if (normalized && normalized !== senderEmail) emails.add(normalized);
}

/**
 * Other participants only — never the sender, never non-participants.
 * Client-wide threads use `clients.email`; linked contacts already arrive
 * via the contacts list and are de-duplicated by email.
 */
export function collectMessageNotifyRecipients(params: {
  senderUserId: string;
  senderEmail?: string | null;
  members: MessageNotifyMember[];
  contacts: MessageNotifyContact[];
  clients?: MessageNotifyClient[];
}): MessageNotifyRecipients {
  const senderEmail = params.senderEmail?.trim().toLowerCase() || null;
  const inApp = new Set<string>();
  const emails = new Set<string>();

  for (const member of params.members) {
    if (member.userId === params.senderUserId) continue;
    inApp.add(member.userId);
    addNotifyEmail(emails, member.email, senderEmail);
  }

  for (const contact of params.contacts) {
    if (contact.userId && contact.userId === params.senderUserId) continue;
    if (contact.userId) inApp.add(contact.userId);
    addNotifyEmail(emails, contact.email, senderEmail);
  }

  for (const client of params.clients ?? []) {
    if (client.userId && client.userId === params.senderUserId) continue;
    if (client.userId) inApp.add(client.userId);
    addNotifyEmail(emails, client.email, senderEmail);
  }

  return {
    inAppUserIds: Array.from(inApp),
    emails: Array.from(emails),
  };
}
