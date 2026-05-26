import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type {
  EveningPart,
  GroupMemberOption,
  MeetupDetail,
  MeetupListRow,
  MeetupSeriesOption,
  MeetupTemplate,
  MemberNoteRow,
} from '../community-schedule.types';

function isMissingTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

function parseEveningParts(raw: unknown): EveningPart[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      const o = item as { id?: string; title?: string; notes?: string };
      return {
        id: o.id ?? `part-${i}`,
        title: (o.title ?? '').trim() || `Part ${i + 1}`,
        notes: (o.notes ?? '').trim(),
      };
    })
    .filter((p) => p.title);
}

function formatRowLabels(startsAt: string) {
  const d = new Date(startsAt);
  return {
    dateLabel: d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    timeLabel: d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    isPast: d.getTime() < Date.now(),
  };
}

async function resolveAccountId(
  client: ReturnType<typeof getSupabaseServerClient>,
  accountSlug: string,
) {
  const { data } = await client
    .from('accounts')
    .select('id')
    .eq('slug', accountSlug)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export const loadCommunitySchedulePage = cache(
  async (accountSlug: string) => {
    const client = getSupabaseServerClient();
    const accountId = await resolveAccountId(client, accountSlug);
    if (!accountId) {
      return {
        accountSlug,
        accountId: null as string | null,
        upcoming: [] as MeetupListRow[],
        past: [] as MeetupListRow[],
        series: [] as MeetupSeriesOption[],
        templates: [] as MeetupTemplate[],
        members: [] as GroupMemberOption[],
        tablesReady: false,
      };
    }

    const { data: events, error } = await client
      .from('account_calendar_events')
      .select(
        'id, title, starts_at, ends_at, location, status, series_id, series_label',
      )
      .eq('account_id', accountId)
      .order('starts_at', { ascending: true });

    if (isMissingTable(error)) {
      return {
        accountSlug,
        accountId,
        upcoming: [],
        past: [],
        series: [],
        templates: [],
        members: [],
        tablesReady: false,
      };
    }

    const eventIds = (events ?? []).map((e) => (e as { id: string }).id);
    const attendeeCounts = new Map<string, number>();

    if (eventIds.length > 0) {
      const { data: attRows } = await client
        .from('community_meetup_attendees')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'going');

      for (const row of attRows ?? []) {
        const eid = (row as { event_id: string }).event_id;
        attendeeCounts.set(eid, (attendeeCounts.get(eid) ?? 0) + 1);
      }
    }

    const [{ data: seriesRows }, { data: templateRows }, membersResult] =
      await Promise.all([
        client
          .from('community_meetup_series')
          .select('id, name')
          .eq('account_id', accountId)
          .order('name'),
        client
          .from('community_meetup_templates')
          .select(
            'id, name, default_title, meal_plan, evening_parts, content_items',
          )
          .eq('account_id', accountId)
          .order('name'),
        client.rpc('get_account_members', { account_slug: accountSlug }),
      ]);

    const seriesNameById = new Map<string, string>();
    for (const s of seriesRows ?? []) {
      const row = s as { id: string; name?: string };
      seriesNameById.set(row.id, (row.name ?? '').trim());
    }

    const rows: MeetupListRow[] = (events ?? []).map((row) => {
      const r = row as {
        id: string;
        title?: string;
        starts_at: string;
        ends_at?: string | null;
        location?: string | null;
        status?: string;
        series_id?: string | null;
        series_label?: string | null;
      };
      const labels = formatRowLabels(r.starts_at);
      const sid = r.series_id ?? null;
      return {
        id: r.id,
        title: (r.title ?? 'Meetup').trim(),
        startsAt: r.starts_at,
        endsAt: r.ends_at ?? null,
        location: (r.location ?? '').trim() || null,
        status: r.status ?? 'scheduled',
        seriesId: sid,
        seriesName: sid ? seriesNameById.get(sid) ?? null : null,
        seriesLabel: (r.series_label ?? '').trim() || null,
        attendeeCount: attendeeCounts.get(r.id) ?? 0,
        ...labels,
      };
    });

    const upcoming = rows.filter((r) => !r.isPast && r.status !== 'cancelled');
    const past = rows
      .filter((r) => r.isPast || r.status === 'completed')
      .reverse();

    const series: MeetupSeriesOption[] = (seriesRows ?? []).map((s) => ({
      id: (s as { id: string }).id,
      name: ((s as { name?: string }).name ?? '').trim(),
    }));

    const templates: MeetupTemplate[] = (templateRows ?? []).map((t) => {
      const row = t as {
        id: string;
        name?: string;
        default_title?: string | null;
        meal_plan?: string | null;
        evening_parts?: unknown;
        content_items?: unknown;
      };
      const contentRaw = Array.isArray(row.content_items)
        ? row.content_items
        : [];
      return {
        id: row.id,
        name: (row.name ?? '').trim(),
        defaultTitle: (row.default_title ?? '').trim() || null,
        mealPlan: (row.meal_plan ?? '').trim() || null,
        eveningParts: parseEveningParts(row.evening_parts),
        contentItems: contentRaw.map((c) => {
          const o = c as {
            kind?: string;
            title?: string;
            body?: string;
            url?: string;
          };
          return {
            kind: (o.kind ?? 'richtext') as MeetupTemplate['contentItems'][0]['kind'],
            title: (o.title ?? '').trim() || 'Item',
            body: o.body,
            url: o.url,
          };
        }),
      };
    });

    type MemberRpc = {
      id?: string;
      display_name?: string | null;
      email?: string | null;
    };
    const members: GroupMemberOption[] = (
      (membersResult.data ?? []) as MemberRpc[]
    ).map((m) => ({
      userId: m.id ?? '',
      displayName: m.display_name?.trim() || m.email || 'Member',
    }));

    return {
      accountSlug,
      accountId,
      upcoming,
      past,
      series,
      templates,
      members,
      tablesReady: true,
    };
  },
);

export const loadCommunityMeetupDetail = cache(
  async (accountSlug: string, eventId: string) => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const accountId = await resolveAccountId(client, accountSlug);
    if (!accountId) return null;

    const { data: event, error } = await client
      .from('account_calendar_events')
      .select(
        'id, account_id, title, starts_at, ends_at, location, session_notes, meal_plan, evening_parts, status, series_id, series_label, template_id',
      )
      .eq('id', eventId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error || !event) return null;

    const ev = event as {
      id: string;
      account_id: string;
      title?: string;
      starts_at: string;
      ends_at?: string | null;
      location?: string | null;
      session_notes?: string | null;
      meal_plan?: string | null;
      evening_parts?: unknown;
      status?: string;
      series_id?: string | null;
      series_label?: string | null;
      template_id?: string | null;
    };

    const [{ data: contentRows }, { data: attRows }, { data: recordRow }, membersResult] =
      await Promise.all([
        client
          .from('community_meetup_content_items')
          .select('id, kind, title, body, url, sort_order')
          .eq('event_id', eventId)
          .order('sort_order'),
        client
          .from('community_meetup_attendees')
          .select('user_id, status')
          .eq('event_id', eventId),
        client
          .from('community_meetup_records')
          .select('transcript, ai_summary, reflection_notes, summarized_at')
          .eq('event_id', eventId)
          .maybeSingle(),
        client.rpc('get_account_members', { account_slug: accountSlug }),
      ]);

    type MemberRpc = {
      id?: string;
      display_name?: string | null;
      email?: string | null;
    };
    const memberMap = new Map<string, string>();
    for (const m of (membersResult.data ?? []) as MemberRpc[]) {
      if (m.id) {
        memberMap.set(m.id, m.display_name?.trim() || m.email || 'Member');
      }
    }

    const attByUser = new Map(
      (attRows ?? []).map((a) => [
        (a as { user_id: string }).user_id,
        (a as { status: string }).status as 'going' | 'maybe' | 'not_going',
      ]),
    );

    const attendees = [...memberMap.entries()].map(([userId, displayName]) => ({
      userId,
      displayName,
      status: attByUser.get(userId) ?? ('not_going' as const),
    }));

    const detail: MeetupDetail = {
      id: ev.id,
      accountId: ev.account_id,
      title: (ev.title ?? 'Meetup').trim(),
      startsAt: ev.starts_at,
      endsAt: ev.ends_at ?? null,
      location: (ev.location ?? '').trim() || null,
      sessionNotes: (ev.session_notes ?? '').trim() || null,
      mealPlan: (ev.meal_plan ?? '').trim() || null,
      eveningParts: parseEveningParts(ev.evening_parts),
      status: ev.status ?? 'scheduled',
      seriesId: ev.series_id ?? null,
      seriesName: null,
      seriesLabel: (ev.series_label ?? '').trim() || null,
      templateId: ev.template_id ?? null,
      contentItems: (contentRows ?? []).map((c) => {
        const row = c as {
          id: string;
          kind: string;
          title?: string;
          body?: string | null;
          url?: string | null;
          sort_order?: number;
        };
        return {
          id: row.id,
          kind: row.kind as MeetupDetail['contentItems'][0]['kind'],
          title: (row.title ?? '').trim() || 'Content',
          body: (row.body ?? '').trim() || null,
          url: (row.url ?? '').trim() || null,
          sortOrder: row.sort_order ?? 0,
        };
      }),
      attendees,
      record: recordRow
        ? {
            transcript:
              ((recordRow as { transcript?: string | null }).transcript ??
                ''
              ).trim() || null,
            aiSummary:
              ((recordRow as { ai_summary?: string | null }).ai_summary ??
                ''
              ).trim() || null,
            reflectionNotes:
              ((
                recordRow as { reflection_notes?: string | null }
              ).reflection_notes ?? ''
              ).trim() || null,
            summarizedAt:
              (recordRow as { summarized_at?: string | null }).summarized_at ??
              null,
          }
        : null,
    };

    let seriesName: string | null = null;
    if (ev.series_id) {
      const { data: seriesRow } = await client
        .from('community_meetup_series')
        .select('name')
        .eq('id', ev.series_id)
        .maybeSingle();
      seriesName = ((seriesRow as { name?: string } | null)?.name ?? '').trim() || null;
    }

    return {
      detail: { ...detail, seriesName },
      currentUserId: user.id,
      accountSlug,
      series: await loadSeriesOptions(client, accountId),
    };
  },
);

async function loadSeriesOptions(
  client: ReturnType<typeof getSupabaseServerClient>,
  accountId: string,
): Promise<MeetupSeriesOption[]> {
  const { data } = await client
    .from('community_meetup_series')
    .select('id, name')
    .eq('account_id', accountId)
    .order('name');
  return (data ?? []).map((s) => ({
    id: (s as { id: string }).id,
    name: ((s as { name?: string }).name ?? '').trim(),
  }));
}

export const loadCommunityMemberNotes = cache(
  async (accountSlug: string) => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const accountId = await resolveAccountId(client, accountSlug);
    if (!accountId) return { notes: [] as MemberNoteRow[], members: [] as GroupMemberOption[] };

    const { data: noteRows, error } = await client
      .from('community_member_notes')
      .select(
        'id, subject_user_id, author_user_id, visibility, category, content, created_at',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (isMissingTable(error)) {
      return { notes: [], members: [] };
    }

    const { data: membersRpc } = await client.rpc('get_account_members', {
      account_slug: accountSlug,
    });

    type MemberRpc = {
      id?: string;
      display_name?: string | null;
      email?: string | null;
      account_role?: string | null;
    };
    const members: GroupMemberOption[] = (
      (membersRpc ?? []) as MemberRpc[]
    ).map((m) => ({
      userId: m.id ?? '',
      displayName: m.display_name?.trim() || m.email || 'Member',
    }));
    const nameById = new Map(members.map((m) => [m.userId, m.displayName]));

    const notes: MemberNoteRow[] = (noteRows ?? []).map((n) => {
      const row = n as {
        id: string;
        subject_user_id: string;
        author_user_id: string;
        visibility: MemberNoteRow['visibility'];
        category: MemberNoteRow['category'];
        content: string;
        created_at: string;
      };
      return {
        id: row.id,
        subjectUserId: row.subject_user_id,
        subjectName: nameById.get(row.subject_user_id) ?? 'Member',
        authorUserId: row.author_user_id,
        authorName: nameById.get(row.author_user_id) ?? 'Member',
        visibility: row.visibility,
        category: row.category,
        content: row.content,
        createdAt: row.created_at,
        canEdit: row.author_user_id === user.id,
      };
    });

    return { notes, members };
  },
);
