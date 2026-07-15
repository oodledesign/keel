import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createNotificationsApi } from '@kit/notifications/api';

import pathsConfig from '~/config/paths.config';
import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

export type PeopleReminderType =
  | 'catchup_due'
  | 'birthday_7d'
  | 'birthday_today'
  | 'anniversary_7d'
  | 'anniversary_today';

type ReminderCandidate = {
  userId: string;
  accountId: string;
  personId: string;
  /** Display name (nickname preferred). */
  personName: string;
  fullName: string;
  nickname: string | null;
  relationshipLabel: string | null;
  email: string | null;
  phone: string | null;
  lastCatchupOn: string | null;
  catchupCadenceDays: number | null;
  daysSinceLastCatchup: number | null;
  lastCatchupLocation: string | null;
  lastCatchupNote: string | null;
  reminderType: PeopleReminderType;
  referenceDate: string;
  userEmail: string;
};

function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return todayYmd(date);
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

function occurrenceYmd(month: number, day: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd).getTime();
  const b = parseYmd(toYmd).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatGbDate(ymd: string | null | undefined): string | null {
  if (!ymd) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parseYmd(ymd));
  } catch {
    return ymd;
  }
}

function truncatePlain(value: string, max: number) {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function detailRow(label: string, value: string | null | undefined) {
  if (!value?.trim()) return '';
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#9B8590;width:120px;vertical-align:top;">${escapeEmailHtml(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#2A1720;vertical-align:top;">${escapeEmailHtml(value)}</td>
  </tr>`;
}

function personDetailsBlock(input: {
  fullName: string;
  personName: string;
  nickname: string | null;
  relationshipLabel: string | null;
  email: string | null;
  phone: string | null;
  lastCatchupOn: string | null;
  daysSinceLastCatchup: number | null;
  catchupCadenceDays: number | null;
  lastCatchupLocation: string | null;
  lastCatchupNote: string | null;
  includeCatchupContext: boolean;
}) {
  const showLegalName =
    Boolean(input.nickname?.trim()) &&
    input.fullName.trim().toLowerCase() !== input.personName.trim().toLowerCase();

  const lastMet =
    input.lastCatchupOn && input.daysSinceLastCatchup != null
      ? `${formatGbDate(input.lastCatchupOn)} · ${input.daysSinceLastCatchup} day${
          input.daysSinceLastCatchup === 1 ? '' : 's'
        } ago`
      : formatGbDate(input.lastCatchupOn);

  const cadence =
    input.catchupCadenceDays && input.catchupCadenceDays > 0
      ? `Every ${input.catchupCadenceDays} day${input.catchupCadenceDays === 1 ? '' : 's'}`
      : null;

  const rows = [
    showLegalName ? detailRow('Full name', input.fullName) : '',
    detailRow('Relationship', input.relationshipLabel),
    detailRow('Email', input.email),
    detailRow('Phone', input.phone),
    input.includeCatchupContext ? detailRow('Last met', lastMet) : '',
    input.includeCatchupContext ? detailRow('Cadence', cadence) : '',
    input.includeCatchupContext
      ? detailRow('Last place', input.lastCatchupLocation)
      : '',
  ]
    .filter(Boolean)
    .join('');

  if (!rows && !input.lastCatchupNote) return '';

  const note =
    input.includeCatchupContext && input.lastCatchupNote
      ? `<p style="margin:14px 0 0;padding:12px 14px;background:#FBF6EC;border:1px solid #E7DECF;border-radius:10px;font-size:13px;line-height:1.55;color:#5A4450;"><strong style="color:#2A1720;">Last catch-up note</strong><br />${escapeEmailHtml(
          truncatePlain(input.lastCatchupNote, 280),
        )}</p>`
      : '';

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 4px;border-collapse:collapse;">
  ${rows}
</table>
${note}`.trim();
}

function buildReminderEmail(input: {
  productName: string;
  personName: string;
  fullName: string;
  nickname: string | null;
  relationshipLabel: string | null;
  email: string | null;
  phone: string | null;
  lastCatchupOn: string | null;
  daysSinceLastCatchup: number | null;
  catchupCadenceDays: number | null;
  lastCatchupLocation: string | null;
  lastCatchupNote: string | null;
  reminderType: PeopleReminderType;
  profileUrl: string;
}) {
  const name = escapeEmailHtml(input.personName);
  const details = personDetailsBlock({
    ...input,
    includeCatchupContext: input.reminderType === 'catchup_due',
  });

  const footerNote = `You're receiving this because you set People reminders in ${escapeEmailHtml(input.productName)}.`;

  switch (input.reminderType) {
    case 'catchup_due': {
      const overdueLabel =
        input.daysSinceLastCatchup != null
          ? `It's been ${input.daysSinceLastCatchup} day${
              input.daysSinceLastCatchup === 1 ? '' : 's'
            } since you last connected.`
          : `It's been a while since you connected.`;

      return {
        subject: `Time to catch up with ${input.personName}`,
        preview: `${overdueLabel} Open their profile to schedule a catch-up.`,
        html: renderOzerTransactionalEmail({
          productName: input.productName,
          title: `Time to catch up with ${input.personName}`,
          preview: `Catch up with ${input.personName}`,
          heading: `Time to catch up with ${input.personName}`,
          bodyHtml: `<p style="margin:0 0 12px;">${escapeEmailHtml(overdueLabel)}</p>
            <p style="margin:0;">Schedule a catch-up while it's on your mind — log a meetup or add a quick note so nothing slips.</p>
            ${details}`,
          cta: { label: 'Open their profile', href: input.profileUrl },
          footerNote,
        }),
        body: `Time to catch up with ${input.personName}. Open their profile to log a meetup or add a note.`,
      };
    }
    case 'birthday_today':
      return {
        subject: `${input.personName}'s birthday is today`,
        preview: `Wish ${input.personName} a happy birthday.`,
        html: renderOzerTransactionalEmail({
          productName: input.productName,
          title: `${input.personName}'s birthday is today`,
          preview: `Birthday today — ${input.personName}`,
          heading: `${input.personName}'s birthday is today`,
          bodyHtml: `<p style="margin:0 0 12px;"><strong>${name}</strong>'s birthday is today.</p>
            <p style="margin:0;">Check their profile for gift ideas and notes before you message them.</p>
            ${details}`,
          cta: { label: 'Open profile', href: input.profileUrl },
          footerNote,
        }),
        body: `${input.personName}'s birthday is today.`,
      };
    case 'birthday_7d':
      return {
        subject: `${input.personName}'s birthday is in 7 days`,
        preview: `A week to plan something thoughtful for ${input.personName}.`,
        html: renderOzerTransactionalEmail({
          productName: input.productName,
          title: `${input.personName}'s birthday is in 7 days`,
          preview: `Birthday in 7 days — ${input.personName}`,
          heading: `${input.personName}'s birthday is in a week`,
          bodyHtml: `<p style="margin:0 0 12px;"><strong>${name}</strong>'s birthday is coming up in seven days.</p>
            <p style="margin:0;">Open their profile for gift ideas and anything you've already noted.</p>
            ${details}`,
          cta: { label: 'View gift ideas', href: input.profileUrl },
          footerNote,
        }),
        body: `${input.personName}'s birthday is in 7 days.`,
      };
    case 'anniversary_today':
      return {
        subject: `${input.personName}'s anniversary is today`,
        preview: `Today is ${input.personName}'s anniversary.`,
        html: renderOzerTransactionalEmail({
          productName: input.productName,
          title: `${input.personName}'s anniversary is today`,
          preview: `Anniversary today — ${input.personName}`,
          heading: `Today is ${input.personName}'s anniversary`,
          bodyHtml: `<p style="margin:0;">A quick moment to celebrate <strong>${name}</strong> — check notes on their profile if you want ideas.</p>
            ${details}`,
          cta: { label: 'Open profile', href: input.profileUrl },
          footerNote,
        }),
        body: `${input.personName}'s anniversary is today.`,
      };
    case 'anniversary_7d':
      return {
        subject: `${input.personName}'s anniversary is in 7 days`,
        preview: `${input.personName}'s anniversary is in a week.`,
        html: renderOzerTransactionalEmail({
          productName: input.productName,
          title: `${input.personName}'s anniversary is in 7 days`,
          preview: `Anniversary in 7 days — ${input.personName}`,
          heading: `${input.personName}'s anniversary is in a week`,
          bodyHtml: `<p style="margin:0;">You've got a week to plan something for <strong>${name}</strong>.</p>
            ${details}`,
          cta: { label: 'Open profile', href: input.profileUrl },
          footerNote,
        }),
        body: `${input.personName}'s anniversary is in 7 days.`,
      };
  }
}

async function loadUserEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

async function loadReminderCandidates(
  admin: SupabaseClient,
  now = new Date(),
): Promise<ReminderCandidate[]> {
  const today = todayYmd(now);
  const year = now.getFullYear();

  const { data: people, error } = await admin
    .from('personal_people')
    .select(
      'id, user_id, account_id, full_name, nickname, relationship_label, email, phone, catchup_cadence_days, last_catchup_on, created_at',
    );

  if (error || !people?.length) return [];

  const personIds = people.map((p) => (p as { id: string }).id);
  const { data: dates } = await admin
    .from('personal_person_dates')
    .select('person_id, kind, month, day')
    .in('person_id', personIds);

  const { data: recentCatchups } = await admin
    .from('personal_person_catchups')
    .select('person_id, met_on, location, conversation_notes')
    .in('person_id', personIds)
    .order('met_on', { ascending: false });

  const latestCatchupByPerson = new Map<
    string,
    { location: string | null; note: string | null }
  >();
  for (const row of recentCatchups ?? []) {
    const r = row as {
      person_id: string;
      location: string | null;
      conversation_notes: string | null;
    };
    if (latestCatchupByPerson.has(r.person_id)) continue;
    latestCatchupByPerson.set(r.person_id, {
      location: r.location,
      note: r.conversation_notes,
    });
  }

  const datesByPerson = new Map<
    string,
    Array<{ kind: string; month: number; day: number }>
  >();
  for (const row of dates ?? []) {
    const r = row as {
      person_id: string;
      kind: string;
      month: number;
      day: number;
    };
    const list = datesByPerson.get(r.person_id) ?? [];
    list.push({ kind: r.kind, month: r.month, day: r.day });
    datesByPerson.set(r.person_id, list);
  }

  const emailCache = new Map<string, string | null>();
  const candidates: ReminderCandidate[] = [];

  for (const row of people) {
    const p = row as {
      id: string;
      user_id: string;
      account_id: string;
      full_name: string;
      nickname: string | null;
      relationship_label: string | null;
      email: string | null;
      phone: string | null;
      catchup_cadence_days: number | null;
      last_catchup_on: string | null;
      created_at: string;
    };

    const personName = p.nickname?.trim() || p.full_name;
    const lastCatchup =
      p.last_catchup_on ??
      (p.created_at ? p.created_at.slice(0, 10) : null);
    const daysSinceLastCatchup = lastCatchup
      ? daysBetween(lastCatchup, today)
      : null;
    const catchupMeta = latestCatchupByPerson.get(p.id);

    const baseFields = {
      userId: p.user_id,
      accountId: p.account_id,
      personId: p.id,
      personName,
      fullName: p.full_name,
      nickname: p.nickname,
      relationshipLabel: p.relationship_label,
      email: p.email,
      phone: p.phone,
      lastCatchupOn: p.last_catchup_on,
      catchupCadenceDays: p.catchup_cadence_days,
      daysSinceLastCatchup,
      lastCatchupLocation: catchupMeta?.location ?? null,
      lastCatchupNote: catchupMeta?.note ?? null,
    };

    if (p.catchup_cadence_days && p.catchup_cadence_days > 0) {
      const anchor = p.last_catchup_on ?? p.created_at.slice(0, 10);
      const dueOn = addDaysYmd(anchor, p.catchup_cadence_days);
      if (dueOn <= today) {
        let email = emailCache.get(p.user_id);
        if (email === undefined) {
          email = await loadUserEmail(admin, p.user_id);
          emailCache.set(p.user_id, email);
        }
        if (email) {
          candidates.push({
            ...baseFields,
            reminderType: 'catchup_due',
            referenceDate: dueOn,
            userEmail: email,
          });
        }
      }
    }

    const personDates = datesByPerson.get(p.id) ?? [];
    for (const d of personDates) {
      const ref = occurrenceYmd(d.month, d.day, year);
      const daysUntil = daysBetween(today, ref);

      let reminderType: PeopleReminderType | null = null;
      if (d.kind === 'birthday') {
        if (daysUntil === 0) reminderType = 'birthday_today';
        else if (daysUntil === 7) reminderType = 'birthday_7d';
      } else if (d.kind === 'anniversary') {
        if (daysUntil === 0) reminderType = 'anniversary_today';
        else if (daysUntil === 7) reminderType = 'anniversary_7d';
      }

      if (!reminderType) continue;

      let email = emailCache.get(p.user_id);
      if (email === undefined) {
        email = await loadUserEmail(admin, p.user_id);
        emailCache.set(p.user_id, email);
      }
      if (!email) continue;

      candidates.push({
        ...baseFields,
        reminderType,
        referenceDate: ref,
        userEmail: email,
      });
    }
  }

  return candidates;
}

export async function runPersonalPeopleReminders(
  admin: SupabaseClient,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) {
    return {
      sent: 0,
      skipped: 0,
      errors: ['EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured'],
    };
  }

  const candidates = await loadReminderCandidates(admin);
  const notificationsApi = createNotificationsApi(admin);
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    const { data: existing } = await admin
      .from('personal_people_reminder_log')
      .select('id')
      .eq('person_id', row.personId)
      .eq('reminder_type', row.reminderType)
      .eq('reference_date', row.referenceDate)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const profileUrl = new URL(
      pathsConfig.app.personalPeopleDetail.replace('[personId]', row.personId),
      siteUrl,
    ).toString();

    const { subject, html, body } = buildReminderEmail({
      productName,
      personName: row.personName,
      fullName: row.fullName,
      nickname: row.nickname,
      relationshipLabel: row.relationshipLabel,
      email: row.email,
      phone: row.phone,
      lastCatchupOn: row.lastCatchupOn,
      daysSinceLastCatchup: row.daysSinceLastCatchup,
      catchupCadenceDays: row.catchupCadenceDays,
      lastCatchupLocation: row.lastCatchupLocation,
      lastCatchupNote: row.lastCatchupNote,
      reminderType: row.reminderType,
      profileUrl,
    });

    try {
      await sendPlatformEmail({
        type: 'event',
        accountId: row.accountId,
        mail: {
          to: row.userEmail,
          from: sender,
          subject,
          html,
        },
        metadata: {
          reminder_type: row.reminderType,
          person_id: row.personId,
        },
      });

      await notificationsApi.createNotification({
        account_id: row.accountId,
        type: 'info',
        body,
        link: `/app/people/${row.personId}`,
        channel: 'in_app',
      });

      await admin.from('personal_people_reminder_log').insert({
        user_id: row.userId,
        person_id: row.personId,
        reminder_type: row.reminderType,
        reference_date: row.referenceDate,
      });

      sent++;
    } catch (err) {
      errors.push(
        `${row.personId}/${row.reminderType}: ${err instanceof Error ? err.message : 'send failed'}`,
      );
    }
  }

  return { sent, skipped, errors };
}
