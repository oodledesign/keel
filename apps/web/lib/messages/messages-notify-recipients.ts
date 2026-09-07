export type MessageNotifyMember = {
  userId: string;
  email: string | null;
};

export type MessageNotifyContact = {
  userId: string | null;
  email: string | null;
};

export type MessageNotifyRecipients = {
  inAppUserIds: string[];
  emails: string[];
};

/**
 * Other participants only — never the sender, never non-participants.
 */
export function collectMessageNotifyRecipients(params: {
  senderUserId: string;
  senderEmail?: string | null;
  members: MessageNotifyMember[];
  contacts: MessageNotifyContact[];
}): MessageNotifyRecipients {
  const senderEmail = params.senderEmail?.trim().toLowerCase() || null;
  const inApp = new Set<string>();
  const emails = new Set<string>();

  for (const member of params.members) {
    if (member.userId === params.senderUserId) continue;
    inApp.add(member.userId);
    const email = member.email?.trim().toLowerCase();
    if (email && email !== senderEmail) emails.add(email);
  }

  for (const contact of params.contacts) {
    if (contact.userId && contact.userId === params.senderUserId) continue;
    if (contact.userId) inApp.add(contact.userId);
    const email = contact.email?.trim().toLowerCase();
    if (email && email !== senderEmail) emails.add(email);
  }

  return {
    inAppUserIds: Array.from(inApp),
    emails: Array.from(emails),
  };
}
