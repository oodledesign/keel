import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { HouseholdMemberRow } from '~/home/(user)/life/family/_lib/schema/family-meal.schema';

import {
  MEMORY_NOTE_CATEGORY,
  type MemoryKind,
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
  household_member_id: string;
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

export function createFamilyMemoriesService(client: SupabaseClient) {
  return new FamilyMemoriesService(client);
}

class FamilyMemoriesService {
  constructor(private readonly client: SupabaseClient) {}

  async listHouseholdMembers(accountId: string): Promise<HouseholdMemberRow[]> {
    const result = (await looseFrom(this.client, 'family_household_members')
      .select(
        'id, user_id, account_id, display_name, member_user_id, dietary_tags, excluded_ingredients, sort_order, date_of_birth, avatar_path, is_child, created_at, updated_at',
      )
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true })) as LooseResult;

    throwIfError(result.error, 'Could not load household members');
    return (result.data as HouseholdMemberRow[] | null) ?? [];
  }

  async getHouseholdMember(
    accountId: string,
    memberId: string,
  ): Promise<HouseholdMemberRow | null> {
    const result = await looseFrom(this.client, 'family_household_members')
      .select(
        'id, user_id, account_id, display_name, member_user_id, dietary_tags, excluded_ingredients, sort_order, date_of_birth, avatar_path, is_child, created_at, updated_at',
      )
      .eq('account_id', accountId)
      .eq('id', memberId)
      .maybeSingle();

    throwIfError(result.error, 'Could not load household member');
    return (result.data as HouseholdMemberRow | null) ?? null;
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
      .select('note_id, household_member_id')
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
      uniqueIds.map((household_member_id) => ({
        note_id: noteId,
        household_member_id,
      })),
    );
    throwIfError(inserted.error, 'Could not assign children to this memory');
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
