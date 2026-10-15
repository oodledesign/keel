const DAY_MS = 24 * 60 * 60 * 1000;

export const QUOTE_REMINDER_STAGE = 'quoted';

export type QuoteReminderDeal = {
  id: string;
  accountId: string;
  stage: string;
  /** Used only when the lead has no logged entry into "Quote sent". */
  updatedAt: string;
};

export type QuoteReminderEvent = {
  dealId: string;
  eventType: string;
  toStage: string | null;
  createdAt: string;
};

export type DueQuoteReminder = {
  dealId: string;
  accountId: string;
  enteredAt: string;
  daysInStage: number;
};

function latestBy(
  events: QuoteReminderEvent[],
  match: (event: QuoteReminderEvent) => boolean,
): Map<string, string> {
  const latest = new Map<string, string>();
  for (const event of events) {
    if (!match(event)) continue;
    const current = latest.get(event.dealId);
    if (!current || event.createdAt > current) {
      latest.set(event.dealId, event.createdAt);
    }
  }
  return latest;
}

/**
 * Leads that have sat in "Quote sent" for at least their workspace's reminder
 * days and have not been reminded since they last entered the stage. A lead
 * with no logged stage entry (created before events existed) is reminded once.
 */
export function selectDueQuoteReminders(input: {
  deals: QuoteReminderDeal[];
  events: QuoteReminderEvent[];
  reminderDaysByAccount: Map<string, number>;
  defaultReminderDays: number;
  now?: Date;
}): DueQuoteReminder[] {
  const now = (input.now ?? new Date()).getTime();
  const enteredAtByDeal = latestBy(
    input.events,
    (event) =>
      (event.eventType === 'stage_changed' || event.eventType === 'created') &&
      event.toStage === QUOTE_REMINDER_STAGE,
  );
  const remindedAtByDeal = latestBy(
    input.events,
    (event) => event.eventType === 'reminder_sent',
  );

  const due: DueQuoteReminder[] = [];
  for (const deal of input.deals) {
    if (deal.stage !== QUOTE_REMINDER_STAGE) continue;
    const loggedEntry = enteredAtByDeal.get(deal.id) ?? null;
    const enteredAt = loggedEntry ?? deal.updatedAt;
    const enteredMs = Date.parse(enteredAt);
    if (Number.isNaN(enteredMs)) continue;

    const days =
      input.reminderDaysByAccount.get(deal.accountId) ??
      input.defaultReminderDays;
    if (now - enteredMs < days * DAY_MS) continue;

    const remindedAt = remindedAtByDeal.get(deal.id);
    if (remindedAt && (!loggedEntry || remindedAt >= loggedEntry)) continue;

    due.push({
      dealId: deal.id,
      accountId: deal.accountId,
      enteredAt,
      daysInStage: Math.floor((now - enteredMs) / DAY_MS),
    });
  }
  return due;
}
