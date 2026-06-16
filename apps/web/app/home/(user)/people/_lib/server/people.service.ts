import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { createAccountsApi } from '@kit/accounts/api';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import type {
  CatchupRow,
  GiftIdeaRow,
  PersonCircleTier,
  PersonDateRow,
  PersonNoteRow,
  PersonRow,
} from '../schema/people.schema';
import { DEFAULT_PERSON_CIRCLE_TIER } from '../schema/people.schema';

export type PersonListItem = PersonRow & {
  dates: PersonDateRow[];
  catchupOverdue: boolean;
  birthdayThisWeek: boolean;
  daysUntilBirthday: number | null;
};

export type PersonProfile = PersonRow & {
  dates: PersonDateRow[];
  giftIdeas: GiftIdeaRow[];
  catchups: CatchupRow[];
  notes: PersonNoteRow[];
  catchupOverdue: boolean;
  nextCatchupDueOn: string | null;
  daysUntilBirthday: number | null;
};

export async function resolvePersonalAccountContext(
  client: SupabaseClient,
  userId: string,
): Promise<{ accountId: string }> {
  const api = createAccountsApi(client);
  const workspace = await api.getAccountWorkspace();
  const accountId = (workspace as { id?: string }).id;

  if (!accountId) {
    throw new Error('Personal account not found');
  }

  return { accountId };
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd).getTime();
  const b = parseYmd(toYmd).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function nextOccurrenceMonthDay(month: number, day: number, from = new Date()): string {
  const y = from.getFullYear();
  let candidate = new Date(y, month - 1, day, 12, 0, 0, 0);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  if (candidate < today) {
    candidate = new Date(y + 1, month - 1, day, 12, 0, 0, 0);
  }
  const yy = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, '0');
  const dd = String(candidate.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function computeCatchupOverdue(
  lastCatchupOn: string | null,
  cadenceDays: number | null,
  createdAt: string,
): boolean {
  if (!cadenceDays || cadenceDays <= 0) return false;
  const today = todayYmd();
  const anchor = lastCatchupOn ?? createdAt.slice(0, 10);
  const dueOn = addDaysYmd(anchor, cadenceDays);
  return dueOn <= today;
}

export function computeNextCatchupDueOn(
  lastCatchupOn: string | null,
  cadenceDays: number | null,
  createdAt: string,
): string | null {
  if (!cadenceDays || cadenceDays <= 0) return null;
  const anchor = lastCatchupOn ?? createdAt.slice(0, 10);
  return addDaysYmd(anchor, cadenceDays);
}

export function computeDaysUntilBirthday(
  dates: PersonDateRow[],
  from = new Date(),
): number | null {
  const birthday = dates.find((d) => d.kind === 'birthday');
  if (!birthday) return null;
  const today = todayYmd();
  const next = nextOccurrenceMonthDay(birthday.month, birthday.day, from);
  return daysBetween(today, next);
}

export function isBirthdayWithinDays(
  dates: PersonDateRow[],
  days: number,
  from = new Date(),
): boolean {
  const d = computeDaysUntilBirthday(dates, from);
  return d !== null && d >= 0 && d <= days;
}

export function createPeopleService(client: SupabaseClient) {
  return new PeopleService(client);
}

function normalizePersonRow(row: PersonRow): PersonRow {
  return {
    ...row,
    avatar_url:
      toSupabasePublicStorageUrl(row.avatar_url) ?? row.avatar_url?.trim() ?? null,
  };
}

class PeopleService {
  constructor(private readonly client: SupabaseClient) {}

  private get db(): SupabaseClient {
    return this.client;
  }

  async listPeople(userId: string): Promise<PersonListItem[]> {
    const { data: people, error } = await this.db
      .from('personal_people')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    const rows = (people ?? []) as PersonRow[];
    if (rows.length === 0) return [];

    const ids = rows.map((p) => p.id);
    const { data: dates } = await this.db
      .from('personal_person_dates')
      .select('*')
      .in('person_id', ids);

    const datesByPerson = new Map<string, PersonDateRow[]>();
    for (const d of (dates ?? []) as PersonDateRow[]) {
      const list = datesByPerson.get(d.person_id) ?? [];
      list.push(d);
      datesByPerson.set(d.person_id, list);
    }

    return rows.map((p) => {
      const person = normalizePersonRow({
        ...p,
        circle_tier: p.circle_tier ?? DEFAULT_PERSON_CIRCLE_TIER,
      });
      const personDates = datesByPerson.get(p.id) ?? [];
      const daysUntilBirthday = computeDaysUntilBirthday(personDates);
      return {
        ...person,
        dates: personDates,
        catchupOverdue: computeCatchupOverdue(
          person.last_catchup_on,
          person.catchup_cadence_days,
          person.created_at,
        ),
        birthdayThisWeek: isBirthdayWithinDays(personDates, 7),
        daysUntilBirthday,
      };
    });
  }

  async getPerson(userId: string, personId: string): Promise<PersonProfile | null> {
    const { data: person, error } = await this.db
      .from('personal_people')
      .select('*')
      .eq('id', personId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!person) return null;

    const p = normalizePersonRow({
      ...(person as PersonRow),
      circle_tier:
        (person as PersonRow).circle_tier ?? DEFAULT_PERSON_CIRCLE_TIER,
    });

    const [datesRes, giftsRes, catchupsRes, notesRes] = await Promise.all([
      this.db.from('personal_person_dates').select('*').eq('person_id', personId).order('month').order('day'),
      this.db.from('personal_person_gift_ideas').select('*').eq('person_id', personId).order('created_at', { ascending: false }),
      this.db.from('personal_person_catchups').select('*').eq('person_id', personId).order('met_on', { ascending: false }),
      this.db.from('personal_person_notes').select('*').eq('person_id', personId).order('created_at', { ascending: false }),
    ]);

    const dates = (datesRes.data ?? []) as PersonDateRow[];

    return {
      ...p,
      dates,
      giftIdeas: (giftsRes.data ?? []) as GiftIdeaRow[],
      catchups: (catchupsRes.data ?? []) as CatchupRow[],
      notes: (notesRes.data ?? []) as PersonNoteRow[],
      catchupOverdue: computeCatchupOverdue(
        p.last_catchup_on,
        p.catchup_cadence_days,
        p.created_at,
      ),
      nextCatchupDueOn: computeNextCatchupDueOn(
        p.last_catchup_on,
        p.catchup_cadence_days,
        p.created_at,
      ),
      daysUntilBirthday: computeDaysUntilBirthday(dates),
    };
  }

  async createPerson(
    userId: string,
    accountId: string,
    input: {
      fullName: string;
      nickname?: string | null;
      relationshipLabel?: string | null;
      email?: string | null;
      phone?: string | null;
      generalNotes?: string | null;
      catchupCadenceDays?: number | null;
      circleTier?: PersonCircleTier;
    },
  ): Promise<string> {
    const { data, error } = await this.db
      .from('personal_people')
      .insert({
        user_id: userId,
        account_id: accountId,
        full_name: input.fullName,
        nickname: input.nickname ?? null,
        relationship_label: input.relationshipLabel ?? null,
        email: input.email || null,
        phone: input.phone ?? null,
        general_notes: input.generalNotes ?? null,
        catchup_cadence_days: input.catchupCadenceDays ?? null,
        circle_tier: input.circleTier ?? DEFAULT_PERSON_CIRCLE_TIER,
      })
      .select('id')
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  }

  async updatePerson(
    userId: string,
    input: {
      id: string;
      fullName: string;
      nickname?: string | null;
      relationshipLabel?: string | null;
      email?: string | null;
      phone?: string | null;
      generalNotes?: string | null;
      catchupCadenceDays?: number | null;
      circleTier?: PersonCircleTier;
    },
  ): Promise<void> {
    const { error } = await this.db
      .from('personal_people')
      .update({
        full_name: input.fullName,
        nickname: input.nickname ?? null,
        relationship_label: input.relationshipLabel ?? null,
        email: input.email || null,
        phone: input.phone ?? null,
        general_notes: input.generalNotes ?? null,
        catchup_cadence_days: input.catchupCadenceDays ?? null,
        circle_tier: input.circleTier ?? DEFAULT_PERSON_CIRCLE_TIER,
      })
      .eq('id', input.id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async deletePerson(userId: string, id: string): Promise<void> {
    const { error } = await this.db
      .from('personal_people')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async createDate(input: {
    personId: string;
    kind: string;
    month: number;
    day: number;
    yearOptional?: number | null;
    label?: string | null;
    notes?: string | null;
  }): Promise<string> {
    const { data, error } = await this.db
      .from('personal_person_dates')
      .insert({
        person_id: input.personId,
        kind: input.kind,
        month: input.month,
        day: input.day,
        year_optional: input.yearOptional ?? null,
        label: input.label ?? null,
        notes: input.notes ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  }

  async updateDate(input: {
    id: string;
    kind: string;
    month: number;
    day: number;
    yearOptional?: number | null;
    label?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const { error } = await this.db
      .from('personal_person_dates')
      .update({
        kind: input.kind,
        month: input.month,
        day: input.day,
        year_optional: input.yearOptional ?? null,
        label: input.label ?? null,
        notes: input.notes ?? null,
      })
      .eq('id', input.id);

    if (error) throw error;
  }

  async deleteDate(id: string): Promise<void> {
    const { error } = await this.db
      .from('personal_person_dates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async createGiftIdea(input: {
    personId: string;
    title: string;
    notes?: string | null;
    url?: string | null;
    occasion?: string | null;
  }): Promise<string> {
    const { data, error } = await this.db
      .from('personal_person_gift_ideas')
      .insert({
        person_id: input.personId,
        title: input.title,
        notes: input.notes ?? null,
        url: input.url || null,
        occasion: input.occasion ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  }

  async updateGiftIdea(input: {
    id: string;
    title: string;
    notes?: string | null;
    url?: string | null;
    occasion?: string | null;
    purchased?: boolean;
  }): Promise<void> {
    const { error } = await this.db
      .from('personal_person_gift_ideas')
      .update({
        title: input.title,
        notes: input.notes ?? null,
        url: input.url || null,
        occasion: input.occasion ?? null,
        ...(input.purchased !== undefined ? { purchased: input.purchased } : {}),
      })
      .eq('id', input.id);

    if (error) throw error;
  }

  async deleteGiftIdea(id: string): Promise<void> {
    const { error } = await this.db
      .from('personal_person_gift_ideas')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async createCatchup(input: {
    personId: string;
    metOn: string;
    location?: string | null;
    conversationNotes?: string | null;
  }): Promise<string> {
    const { data, error } = await this.db
      .from('personal_person_catchups')
      .insert({
        person_id: input.personId,
        met_on: input.metOn,
        location: input.location ?? null,
        conversation_notes: input.conversationNotes ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    await this.syncLastCatchupOn(input.personId, input.metOn);

    return (data as { id: string }).id;
  }

  async updateCatchup(input: {
    id: string;
    personId: string;
    metOn: string;
    location?: string | null;
    conversationNotes?: string | null;
  }): Promise<void> {
    const { error } = await this.db
      .from('personal_person_catchups')
      .update({
        met_on: input.metOn,
        location: input.location ?? null,
        conversation_notes: input.conversationNotes ?? null,
      })
      .eq('id', input.id);

    if (error) throw error;

    await this.recomputeLastCatchupOn(input.personId);
  }

  async deleteCatchup(id: string, personId: string): Promise<void> {
    const { error } = await this.db
      .from('personal_person_catchups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await this.recomputeLastCatchupOn(personId);
  }

  private async syncLastCatchupOn(personId: string, metOn: string): Promise<void> {
    const { data: person } = await this.db
      .from('personal_people')
      .select('last_catchup_on')
      .eq('id', personId)
      .maybeSingle();

    const current = (person as { last_catchup_on: string | null } | null)
      ?.last_catchup_on;

    if (!current || metOn >= current) {
      await this.db
        .from('personal_people')
        .update({ last_catchup_on: metOn })
        .eq('id', personId);
    }
  }

  private async recomputeLastCatchupOn(personId: string): Promise<void> {
    const { data } = await this.db
      .from('personal_person_catchups')
      .select('met_on')
      .eq('person_id', personId)
      .order('met_on', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = (data as { met_on: string } | null)?.met_on ?? null;

    await this.db
      .from('personal_people')
      .update({ last_catchup_on: latest })
      .eq('id', personId);
  }

  async createNote(input: { personId: string; body: string }): Promise<string> {
    const { data, error } = await this.db
      .from('personal_person_notes')
      .insert({
        person_id: input.personId,
        body: input.body,
      })
      .select('id')
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  }

  async updateNote(input: { id: string; body: string }): Promise<void> {
    const { error } = await this.db
      .from('personal_person_notes')
      .update({ body: input.body })
      .eq('id', input.id);

    if (error) throw error;
  }

  async deleteNote(id: string): Promise<void> {
    const { error } = await this.db
      .from('personal_person_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
