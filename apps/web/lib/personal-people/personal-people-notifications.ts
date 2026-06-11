import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createNotificationsApi } from '@kit/notifications/api';

import pathsConfig from '~/config/paths.config';
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
  personName: string;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapEmail(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">${body}</body></html>`;
}

function buildReminderEmail(input: {
  productName: string;
  personName: string;
  reminderType: PeopleReminderType;
  profileUrl: string;
}) {
  const name = escapeHtml(input.personName);

  switch (input.reminderType) {
    case 'catchup_due':
      return {
        subject: `Time to catch up with ${input.personName}`,
        html: wrapEmail(
          `<p>It's been a while since you connected with <strong>${name}</strong>.</p>
          <p>Schedule a catchup while it's on your mind.</p>
          <p><a href="${input.profileUrl}">Open their profile in ${escapeHtml(input.productName)}</a></p>`,
        ),
        body: `Time to catch up with ${input.personName}. Open their profile to log a meetup or add a note.`,
      };
    case 'birthday_today':
      return {
        subject: `${input.personName}'s birthday is today`,
        html: wrapEmail(
          `<p><strong>${name}</strong>'s birthday is today.</p>
          <p>Check their profile for gift ideas and notes.</p>
          <p><a href="${input.profileUrl}">Open profile</a></p>`,
        ),
        body: `${input.personName}'s birthday is today.`,
      };
    case 'birthday_7d':
      return {
        subject: `${input.personName}'s birthday is in 7 days`,
        html: wrapEmail(
          `<p><strong>${name}</strong>'s birthday is coming up in a week.</p>
          <p><a href="${input.profileUrl}">View gift ideas and notes</a></p>`,
        ),
        body: `${input.personName}'s birthday is in 7 days.`,
      };
    case 'anniversary_today':
      return {
        subject: `${input.personName}'s anniversary is today`,
        html: wrapEmail(
          `<p>Today is <strong>${name}</strong>'s anniversary.</p>
          <p><a href="${input.profileUrl}">Open profile</a></p>`,
        ),
        body: `${input.personName}'s anniversary is today.`,
      };
    case 'anniversary_7d':
      return {
        subject: `${input.personName}'s anniversary is in 7 days`,
        html: wrapEmail(
          `<p><strong>${name}</strong>'s anniversary is in a week.</p>
          <p><a href="${input.profileUrl}">Open profile</a></p>`,
        ),
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
      'id, user_id, account_id, full_name, nickname, catchup_cadence_days, last_catchup_on, created_at',
    );

  if (error || !people?.length) return [];

  const personIds = people.map((p) => (p as { id: string }).id);
  const { data: dates } = await admin
    .from('personal_person_dates')
    .select('person_id, kind, month, day')
    .in('person_id', personIds);

  const datesByPerson = new Map<
    string,
    Array<{ kind: string; month: number; day: number }>
  >();
  for (const row of dates ?? []) {
    const r = row as { person_id: string; kind: string; month: number; day: number };
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
      catchup_cadence_days: number | null;
      last_catchup_on: string | null;
      created_at: string;
    };

    const personName = p.nickname?.trim() || p.full_name;

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
            userId: p.user_id,
            accountId: p.account_id,
            personId: p.id,
            personName,
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
        userId: p.user_id,
        accountId: p.account_id,
        personId: p.id,
        personName,
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
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Keel';

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
