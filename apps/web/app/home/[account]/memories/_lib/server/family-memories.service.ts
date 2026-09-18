import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { DEFAULT_PERSON_CIRCLE_TIER } from '~/home/(user)/people/_lib/schema/people.schema';

import {
  MEMORY_NOTE_CATEGORY,
  type MemoryKind,
  birthdayIsoFromParts,
  withMemoryKindTags,
} from '../memory-constants';
import type { SaveFamilyMemoryInput } from '../schemas/family-memories.schema';

/** Untyped queries until `pnpm supabase:web:typegen` after the memories migration. */
type LooseResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

type LooseQuery = {
  select: (columns?: string) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  update: (values: unknown) => LooseQuery;
  delete: () => LooseQuery;
  eq: (column: string, value: string) => LooseQuery;
  in: (column: string, values: string[]) => LooseQuery;
  contains: (column: string, value: string[]) => LooseQuery;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => LooseQuery;
  maybeSingle: () => Promise<LooseResult>;
  single: () => Promise<LooseResult>;
  then: (
    resolve: (value: LooseResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

export type FamilyMemoryNoteRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  occurred_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FamilyMemoryChildLink = {
  note_id: string;
  person_id: string;
};

export type FamilyMemoryDocRow = {
  id: string;
  note_id: string | null;
  title: string;
  mime_type: string | null;
  file_path: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
};

export type FamilyMemoryPersonRow = {
  id: string;
  account_id: string;
  user_id: string;
  full_name: string;
  nickname: string | null;
  relationship_label: string | null;
  avatar_url: string | null;
  is_child: boolean;
};

export type FamilyMemoryPersonDateRow = {
  id: string;
  person_id: string;
  kind: string;
  month: number;
  day: number;
  year_optional: number | null;
};

export type UpsertFamilyChildValues = {
  accountId: string;
  userId: string;
  id?: string;
  fullName: string;
  dateOfBirth?: string | null;
  isChild?: boolean;
};

function looseFrom(client: SupabaseClient, table: string): LooseQuery {
  return (client as unknown as { from: (name: string) => LooseQuery }).from(
    table,
  );
}

function throwIfError(error: LooseResult['error'], fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  return { year, month, day };
}

export function birthdayIsoFromPersonDates(
  dates: FamilyMemoryPersonDateRow[],
  personId: string,
) {
  const birthday = dates.find(
    (date) => date.person_id === personId && date.kind === 'birthday',
  );
  if (!birthday) return null;

  return birthdayIsoFromParts(
    birthday.year_optional,
    birthday.month,
    birthday.day,
  );
}

export function createFamilyMemoriesService(client: SupabaseClient) {
  return new FamilyMemoriesService(client);
}

class FamilyMemoriesService {
  constructor(private readonly client: SupabaseClient) {}

  async listAccountPeople(accountId: string): Promise<FamilyMemoryPersonRow[]> {
    const result = (await looseFrom(this.client, 'personal_people')
      .select(
        'id, account_id, user_id, full_name, nickname, relationship_label, avatar_url, is_child',
      )
      .eq('account_id', accountId)
      .order('full_name', { ascending: true })) as LooseResult;

    throwIfError(result.error, 'Could not load people');
    return ((result.data as FamilyMemoryPersonRow[] | null) ?? []).map(
      (person) => ({
        ...person,
        is_child: Boolean(person.is_child),
      }),
    );
  }

  async getAccountPerson(
    accountId: string,
    personId: string,
  ): Promise<FamilyMemoryPersonRow | null> {
    const result = await looseFrom(this.client, 'personal_people')
      .select(
        'id, account_id, user_id, full_name, nickname, relationship_label, avatar_url, is_child',
      )
      .eq('account_id', accountId)
      .eq('id', personId)
      .maybeSingle();

    throwIfError(result.error, 'Could not load person');
    const person = result.data as FamilyMemoryPersonRow | null;
    if (!person) return null;

    return { ...person, is_child: Boolean(person.is_child) };
  }

  async listPersonDates(
    personIds: string[],
  ): Promise<FamilyMemoryPersonDateRow[]> {
    if (personIds.length === 0) return [];

    const result = (await looseFrom(this.client, 'personal_person_dates')
      .select('id, person_id, kind, month, day, year_optional')
      .in('person_id', personIds)) as LooseResult;

    throwIfError(result.error, 'Could not load birthdays');
    return (result.data as FamilyMemoryPersonDateRow[] | null) ?? [];
  }

  async listMemoryNotes(options: {
    accountId: string;
    kind?: MemoryKind | null;
  }): Promise<FamilyMemoryNoteRow[]> {
    let query = looseFrom(this.client, 'notes')
      .select(
        'id, title, content, category, tags, occurred_at, created_at, updated_at',
      )
      .eq('account_id', options.accountId)
      .eq('category', MEMORY_NOTE_CATEGORY);

    if (options.kind) {
      query = query.contains('tags', [`mk:${options.kind}`]);
    }

    const result = (await query.order('occurred_at', {
      ascending: false,
      nullsFirst: false,
    })) as LooseResult;

    throwIfError(result.error, 'Could not load memories');
    return ((result.data as FamilyMemoryNoteRow[] | null) ?? []).sort(
      (a, b) => {
        const aDate = a.occurred_at ?? a.created_at;
        const bDate = b.occurred_at ?? b.created_at;
        return bDate.localeCompare(aDate);
      },
    );
  }

  async listChildLinks(noteIds: string[]): Promise<FamilyMemoryChildLink[]> {
    if (noteIds.length === 0) return [];

    const result = (await looseFrom(this.client, 'family_memory_children')
      .select('note_id, person_id')
      .in('note_id', noteIds)) as LooseResult;

    throwIfError(result.error, 'Could not load memory children');
    return (result.data as FamilyMemoryChildLink[] | null) ?? [];
  }

  async listDocsForNotes(options: {
    accountId: string;
    noteIds: string[];
  }): Promise<FamilyMemoryDocRow[]> {
    if (options.noteIds.length === 0) return [];

    const result = (await looseFrom(this.client, 'docs')
      .select(
        'id, note_id, title, mime_type, file_path, storage_path, storage_bucket',
      )
      .eq('account_id', options.accountId)
      .in('note_id', options.noteIds)) as LooseResult;

    throwIfError(result.error, 'Could not load memory photos');
    return (result.data as FamilyMemoryDocRow[] | null) ?? [];
  }

  async saveMemory(
    input: SaveFamilyMemoryInput,
    userId: string,
  ): Promise<{ noteId: string }> {
    const title = input.title?.trim() ?? '';
    const tags = withMemoryKindTags([], input.kind ?? null);

    if (input.noteId) {
      const existing = await this.getMemoryNote(input.accountId, input.noteId);
      const nextTags = withMemoryKindTags(
        existing?.tags ?? [],
        input.kind ?? null,
      );

      const { error } = await looseFrom(this.client, 'notes')
        .update({
          title,
          content: input.content,
          category: MEMORY_NOTE_CATEGORY,
          tags: nextTags,
          occurred_at: input.occurredAt,
        })
        .eq('id', input.noteId)
        .eq('account_id', input.accountId);

      throwIfError(error, 'Could not update memory');
      await this.replaceChildren(input.noteId, input.childIds);
      return { noteId: input.noteId };
    }

    const inserted = await looseFrom(this.client, 'notes')
      .insert({
        account_id: input.accountId,
        title,
        content: input.content,
        category: MEMORY_NOTE_CATEGORY,
        tags,
        occurred_at: input.occurredAt,
        is_pinned: false,
        user_id: userId,
        created_by: userId,
      })
      .select('id')
      .single();

    throwIfError(inserted.error, 'Could not save memory');
    const noteId = (inserted.data as { id: string }).id;
    await this.replaceChildren(noteId, input.childIds);
    return { noteId };
  }

  async replaceChildren(noteId: string, childIds: string[]) {
    const uniqueIds = [...new Set(childIds)];

    const deleted = await looseFrom(this.client, 'family_memory_children')
      .delete()
      .eq('note_id', noteId);
    throwIfError(deleted.error, 'Could not update memory children');

    if (uniqueIds.length === 0) return;

    const inserted = await looseFrom(
      this.client,
      'family_memory_children',
    ).insert(
      uniqueIds.map((person_id) => ({
        note_id: noteId,
        person_id,
      })),
    );
    throwIfError(inserted.error, 'Could not assign children to this memory');
  }

  async upsertChild(input: UpsertFamilyChildValues): Promise<{ id: string }> {
    const fullName = input.fullName.trim();
    const isChild = input.isChild ?? true;

    if (input.id) {
      const existing = await this.getAccountPerson(input.accountId, input.id);
      if (!existing) {
        throw new Error('Person not found');
      }

      const { error } = await looseFrom(this.client, 'personal_people')
        .update({
          full_name: fullName,
          is_child: isChild,
          relationship_label: isChild ? 'Child' : existing.relationship_label,
        })
        .eq('id', input.id)
        .eq('account_id', input.accountId);

      throwIfError(error, 'Could not update person');
      await this.syncBirthday(input.id, input.dateOfBirth);
      return { id: input.id };
    }

    const inserted = await looseFrom(this.client, 'personal_people')
      .insert({
        user_id: input.userId,
        account_id: input.accountId,
        full_name: fullName,
        relationship_label: isChild ? 'Child' : null,
        is_child: isChild,
        circle_tier: isChild ? 'core' : DEFAULT_PERSON_CIRCLE_TIER,
      })
      .select('id')
      .single();

    throwIfError(inserted.error, 'Could not add child');
    const id = (inserted.data as { id: string }).id;
    await this.syncBirthday(id, input.dateOfBirth);
    return { id };
  }

  private async syncBirthday(
    personId: string,
    dateOfBirth: string | null | undefined,
  ) {
    if (dateOfBirth === undefined) return;

    const dates = await this.listPersonDates([personId]);
    const existing = dates.find((date) => date.kind === 'birthday') ?? null;

    if (!dateOfBirth) {
      if (!existing) return;

      const deleted = await looseFrom(this.client, 'personal_person_dates')
        .delete()
        .eq('id', existing.id);
      throwIfError(deleted.error, 'Could not clear birthday');
      return;
    }

    const parsed = parseIsoDate(dateOfBirth);
    if (!parsed) {
      throw new Error('Birthday must be a valid date');
    }

    if (existing) {
      const { error } = await looseFrom(this.client, 'personal_person_dates')
        .update({
          month: parsed.month,
          day: parsed.day,
          year_optional: parsed.year,
        })
        .eq('id', existing.id);
      throwIfError(error, 'Could not update birthday');
      return;
    }

    const inserted = await looseFrom(
      this.client,
      'personal_person_dates',
    ).insert({
      person_id: personId,
      kind: 'birthday',
      month: parsed.month,
      day: parsed.day,
      year_optional: parsed.year,
    });
    throwIfError(inserted.error, 'Could not save birthday');
  }

  private async getMemoryNote(accountId: string, noteId: string) {
    const result = await looseFrom(this.client, 'notes')
      .select('id, tags')
      .eq('account_id', accountId)
      .eq('id', noteId)
      .maybeSingle();

    throwIfError(result.error, 'Could not load memory');
    return result.data as { id: string; tags: string[] } | null;
  }
}
