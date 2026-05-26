'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { summarizeMeetupTranscript } from '~/lib/ai/meetup-summary';
import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';
import pathsConfig from '~/config/paths.config';

import type { EveningPart } from '../community-schedule.types';

function revalidateCommunitySchedule(accountSlug: string, eventId?: string) {
  const base = pathsConfig.app.accountCommunitySchedule.replace(
    '[account]',
    accountSlug,
  );
  revalidatePath(base);
  revalidatePath(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  if (eventId) {
    revalidatePath(
      pathsConfig.app.accountCommunityMeetupDetail
        .replace('[account]', accountSlug)
        .replace('[eventId]', eventId),
    );
  }
}

const eveningPartSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string(),
});

const createMeetupSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  title: z.string().min(1).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  sessionNotes: z.string().optional().nullable(),
  mealPlan: z.string().optional().nullable(),
  seriesId: z.string().uuid().optional().nullable(),
  seriesLabel: z.string().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  eveningParts: z.array(eveningPartSchema).optional(),
  attendeeUserIds: z.array(z.string().uuid()).optional(),
});

export const createCommunityMeetup = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    let eveningParts: EveningPart[] = input.eveningParts ?? [];
    let mealPlan = input.mealPlan?.trim() || null;
    let title = input.title.trim();
    let sessionNotes = input.sessionNotes?.trim() || null;

    if (input.templateId) {
      const { data: tpl } = await client
        .from('community_meetup_templates')
        .select('default_title, meal_plan, evening_parts, content_items')
        .eq('id', input.templateId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (tpl) {
        const t = tpl as {
          default_title?: string | null;
          meal_plan?: string | null;
          evening_parts?: unknown;
          content_items?: unknown;
        };
        if (!title && t.default_title) title = t.default_title.trim();
        if (!mealPlan && t.meal_plan) mealPlan = t.meal_plan.trim();
        if (eveningParts.length === 0 && Array.isArray(t.evening_parts)) {
          eveningParts = t.evening_parts as EveningPart[];
        }
      }
    }

    const { data: inserted, error } = await client
      .from('account_calendar_events')
      .insert({
        account_id: input.accountId,
        title,
        starts_at: input.startsAt,
        ends_at: input.endsAt || null,
        location: input.location?.trim() || null,
        session_notes: sanitizeRichTextField(sessionNotes),
        meal_plan: sanitizeRichTextField(mealPlan),
        series_id: input.seriesId || null,
        series_label: input.seriesLabel?.trim() || null,
        template_id: input.templateId || null,
        evening_parts: eveningParts.map((p) => ({
          ...p,
          notes: sanitizeRichTextField(p.notes) ?? '',
        })),
        created_by: user.id,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (error) throw error;

    const eventId = inserted.id as string;

    if (input.templateId) {
      const { data: tpl } = await client
        .from('community_meetup_templates')
        .select('content_items')
        .eq('id', input.templateId)
        .maybeSingle();
      const items = (tpl as { content_items?: unknown } | null)?.content_items;
      if (Array.isArray(items)) {
        const rows = items.map((item, i) => {
          const o = item as {
            kind?: string;
            title?: string;
            body?: string;
            url?: string;
          };
          return {
            event_id: eventId,
            account_id: input.accountId,
            kind: o.kind ?? 'richtext',
            title: (o.title ?? 'Content').trim(),
            body: o.body ?? null,
            url: o.url ?? null,
            sort_order: i,
          };
        });
        if (rows.length > 0) {
          await client.from('community_meetup_content_items').insert(rows);
        }
      }
    }

    const attendeeIds = input.attendeeUserIds ?? [];
    if (attendeeIds.length > 0) {
      await client.from('community_meetup_attendees').insert(
        attendeeIds.map((userId) => ({
          event_id: eventId,
          account_id: input.accountId,
          user_id: userId,
          status: 'going',
        })),
      );
    }

    revalidateCommunitySchedule(input.accountSlug, eventId);
    return { eventId };
  },
  { schema: createMeetupSchema },
);

const updateMeetupSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  eventId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  sessionNotes: z.string().optional().nullable(),
  mealPlan: z.string().optional().nullable(),
  seriesId: z.string().uuid().optional().nullable(),
  seriesLabel: z.string().optional().nullable(),
  eveningParts: z.array(eveningPartSchema).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

export const updateCommunityMeetup = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.startsAt !== undefined) updates.starts_at = input.startsAt;
    if (input.endsAt !== undefined) updates.ends_at = input.endsAt || null;
    if (input.location !== undefined)
      updates.location = input.location?.trim() || null;
    if (input.sessionNotes !== undefined)
      updates.session_notes = sanitizeRichTextField(input.sessionNotes);
    if (input.mealPlan !== undefined)
      updates.meal_plan = sanitizeRichTextField(input.mealPlan);
    if (input.seriesId !== undefined) updates.series_id = input.seriesId;
    if (input.seriesLabel !== undefined)
      updates.series_label = input.seriesLabel?.trim() || null;
    if (input.eveningParts !== undefined) {
      updates.evening_parts = input.eveningParts.map((p) => ({
        ...p,
        notes: sanitizeRichTextField(p.notes) ?? '',
      }));
    }
    if (input.status !== undefined) updates.status = input.status;

    const { error } = await client
      .from('account_calendar_events')
      .update(updates)
      .eq('id', input.eventId)
      .eq('account_id', input.accountId);

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug, input.eventId);
    return { ok: true };
  },
  { schema: updateMeetupSchema },
);

export const setMeetupAttendees = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    await client
      .from('community_meetup_attendees')
      .delete()
      .eq('event_id', input.eventId);

    if (input.attendeeUserIds.length > 0) {
      await client.from('community_meetup_attendees').insert(
        input.attendeeUserIds.map((userId) => ({
          event_id: input.eventId,
          account_id: input.accountId,
          user_id: userId,
          status: 'going' as const,
        })),
      );
    }

    revalidateCommunitySchedule(input.accountSlug, input.eventId);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      eventId: z.string().uuid(),
      attendeeUserIds: z.array(z.string().uuid()),
    }),
  },
);

export const addMeetupContentItem = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: maxRow } = await client
      .from('community_meetup_content_items')
      .select('sort_order')
      .eq('event_id', input.eventId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder =
      ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

    const { data, error } = await client
      .from('community_meetup_content_items')
      .insert({
        event_id: input.eventId,
        account_id: input.accountId,
        kind: input.kind,
        title: input.title.trim() || 'Content',
        body: sanitizeRichTextField(input.body),
        url: input.url?.trim() || null,
        sort_order: nextOrder,
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug, input.eventId);
    return { id: data.id as string };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      eventId: z.string().uuid(),
      kind: z.enum(['richtext', 'link', 'youtube', 'video']),
      title: z.string(),
      body: z.string().optional().nullable(),
      url: z.string().optional().nullable(),
    }),
  },
);

export const deleteMeetupContentItem = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('community_meetup_content_items')
      .delete()
      .eq('id', input.itemId)
      .eq('event_id', input.eventId);

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug, input.eventId);
    return { ok: true };
  },
  {
    schema: z.object({
      accountSlug: z.string().min(1),
      eventId: z.string().uuid(),
      itemId: z.string().uuid(),
    }),
  },
);

export const saveMeetupRecord = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { error } = await client.from('community_meetup_records').upsert(
      {
        event_id: input.eventId,
        account_id: input.accountId,
        transcript: sanitizeRichTextField(input.transcript),
        reflection_notes: sanitizeRichTextField(input.reflectionNotes),
      },
      { onConflict: 'event_id' },
    );

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug, input.eventId);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      eventId: z.string().uuid(),
      transcript: z.string().optional().nullable(),
      reflectionNotes: z.string().optional().nullable(),
    }),
  },
);

export const summarizeMeetupRecord = enhanceAction(
  async (input) => {
    const summary = await summarizeMeetupTranscript(
      input.transcript,
      input.meetupTitle,
    );
    const client = getSupabaseServerClient();
    const now = new Date().toISOString();

    const { error } = await client.from('community_meetup_records').upsert(
      {
        event_id: input.eventId,
        account_id: input.accountId,
        transcript: input.transcript,
        ai_summary: summary,
        summarized_at: now,
      },
      { onConflict: 'event_id' },
    );

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug, input.eventId);
    return { summary };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      eventId: z.string().uuid(),
      meetupTitle: z.string(),
      transcript: z.string().min(20),
    }),
  },
);

export const saveMeetupTemplate = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('community_meetup_templates')
      .insert({
        account_id: input.accountId,
        name: input.name.trim(),
        default_title: input.defaultTitle?.trim() || null,
        meal_plan: input.mealPlan?.trim() || null,
        evening_parts: input.eveningParts ?? [],
        content_items: input.contentItems ?? [],
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug);
    return { id: data.id as string };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      name: z.string().min(1),
      defaultTitle: z.string().optional().nullable(),
      mealPlan: z.string().optional().nullable(),
      eveningParts: z.array(eveningPartSchema).optional(),
      contentItems: z.array(z.unknown()).optional(),
    }),
  },
);

export const createMemberNote = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('community_member_notes')
      .insert({
        account_id: input.accountId,
        subject_user_id: input.subjectUserId,
        author_user_id: user.id,
        visibility: input.visibility,
        category: input.category,
        content: sanitizeRichTextField(input.content) ?? '',
      })
      .select('id')
      .single();

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug);
    return { id: data.id as string };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      subjectUserId: z.string().uuid(),
      visibility: z.enum(['leaders', 'leaders_and_subject', 'private']),
      category: z.enum(['general', 'prayer_request']),
      content: z.string().min(1),
    }),
  },
);

export const createCommunityMeetupSeries = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('community_meetup_series')
      .insert({
        account_id: input.accountId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
      })
      .select('id, name')
      .single();

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug);
    return {
      id: data.id as string,
      name: (data as { name: string }).name,
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      name: z.string().min(1).max(120),
      description: z.string().optional().nullable(),
    }),
  },
);

function sanitizeRichTextField(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return sanitizeCommunityHtml(trimmed);
}

export const deleteMemberNote = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('community_member_notes')
      .delete()
      .eq('id', input.noteId);

    if (error) throw error;
    revalidateCommunitySchedule(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountSlug: z.string().min(1),
      noteId: z.string().uuid(),
    }),
  },
);
