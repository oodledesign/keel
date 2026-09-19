import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import {
  type MemoryKind,
  formatChildAge,
  formatChildAgeOn,
  memoryKindFromTags,
  memoryOccurredOn,
} from '../memory-constants';
import { classifyMemoryMedia } from '../memory-media';
import type { FamilyMemoryMediaItem } from '../schemas/family-memories.schema';
import {
  type FamilyMemoryPersonRow,
  birthdayIsoFromPersonDates,
  createFamilyMemoriesService,
} from './family-memories.service';

export type FamilyMemoryChild = {
  id: string;
  accountId: string;
  fullName: string;
  display_name: string;
  nickname: string | null;
  relationshipLabel: string | null;
  is_child: boolean;
  date_of_birth: string | null;
  avatar_url: string | null;
  avatarUrl: string | null;
  ageLabel: string | null;
  memoryCount: number;
};

export type FamilyMemoryItem = {
  id: string;
  title: string;
  content: string;
  occurredOn: string;
  kind: MemoryKind | null;
  childIds: string[];
  children: Array<
    Pick<FamilyMemoryChild, 'id' | 'display_name' | 'avatarUrl'> & {
      ageLabel: string | null;
    }
  >;
  media: FamilyMemoryMediaItem[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyMemoriesPageData = {
  accountId: string;
  accountSlug: string;
  people: FamilyMemoryChild[];
  children: FamilyMemoryChild[];
  memories: FamilyMemoryItem[];
};

async function signStoragePath(path: string | null | undefined) {
  if (!path) return null;

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .createSignedUrl(path, 3600);

  if (error) return null;
  return data.signedUrl ?? null;
}

function personDisplayName(person: FamilyMemoryPersonRow) {
  return person.nickname?.trim() || person.full_name;
}

function toChild(
  person: FamilyMemoryPersonRow,
  dateOfBirth: string | null,
  memoryCount: number,
): FamilyMemoryChild {
  const displayName = personDisplayName(person);
  const avatarUrl =
    toSupabasePublicStorageUrl(person.avatar_url) ??
    person.avatar_url?.trim() ??
    null;

  return {
    id: person.id,
    accountId: person.account_id,
    fullName: person.full_name,
    display_name: displayName,
    nickname: person.nickname,
    relationshipLabel: person.relationship_label,
    is_child: Boolean(person.is_child),
    date_of_birth: dateOfBirth,
    avatar_url: avatarUrl,
    avatarUrl,
    ageLabel: formatChildAge(dateOfBirth),
    memoryCount,
  };
}

export async function assembleFamilyMemoriesPage(
  client: SupabaseClient,
  options: {
    accountId: string;
    accountSlug: string;
    childId?: string;
    kind?: MemoryKind | null;
  },
): Promise<FamilyMemoriesPageData> {
  const service = createFamilyMemoriesService(client);
  const peopleRows = await service.listAccountPeople(options.accountId);
  const notes = await service.listMemoryNotes({
    accountId: options.accountId,
    kind: options.kind,
  });
  const noteIds = notes.map((note) => note.id);
  const [links, docs, dates] = await Promise.all([
    service.listChildLinks(noteIds),
    service.listDocsForNotes({
      accountId: options.accountId,
      noteIds,
    }),
    service.listPersonDates(peopleRows.map((person) => person.id)),
  ]);

  const linksByNote = new Map<string, string[]>();
  const counts = new Map<string, number>();
  for (const link of links) {
    const current = linksByNote.get(link.note_id) ?? [];
    current.push(link.person_id);
    linksByNote.set(link.note_id, current);
    counts.set(link.person_id, (counts.get(link.person_id) ?? 0) + 1);
  }

  const docsByNote = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (!doc.note_id) continue;
    const current = docsByNote.get(doc.note_id) ?? [];
    current.push(doc);
    docsByNote.set(doc.note_id, current);
  }

  const people = peopleRows.map((person) =>
    toChild(
      person,
      birthdayIsoFromPersonDates(dates, person.id),
      counts.get(person.id) ?? 0,
    ),
  );
  const children = people.filter((person) => person.is_child);
  const personById = new Map(people.map((person) => [person.id, person]));

  const mediaByDocId = new Map<string, string | null>();
  await Promise.all(
    docs.map(async (doc) => {
      mediaByDocId.set(
        doc.id,
        await signStoragePath(doc.file_path ?? doc.storage_path),
      );
    }),
  );

  let memories: FamilyMemoryItem[] = notes.map((note) => {
    const childIds = linksByNote.get(note.id) ?? [];
    const occurredOn = memoryOccurredOn(note.occurred_at, note.created_at);
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      occurredOn,
      kind: memoryKindFromTags(note.tags),
      childIds,
      children: childIds
        .map((id) => personById.get(id))
        .filter(Boolean)
        .map((child) => ({
          id: child!.id,
          display_name: child!.display_name,
          avatarUrl: child!.avatarUrl,
          ageLabel: formatChildAgeOn(child!.date_of_birth, occurredOn),
        })),
      media: (docsByNote.get(note.id) ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        mimeType: doc.mime_type,
        url: mediaByDocId.get(doc.id) ?? null,
        kind: classifyMemoryMedia(doc.mime_type, doc.title),
      })),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    };
  });

  if (options.childId) {
    memories = memories.filter((memory) =>
      memory.childIds.includes(options.childId!),
    );
  }

  return {
    accountId: options.accountId,
    accountSlug: options.accountSlug,
    people,
    children,
    memories,
  };
}

async function loadFamilyMemoriesPageUncached(options: {
  accountSlug: string;
  childId?: string;
  kind?: MemoryKind | null;
}): Promise<FamilyMemoriesPageData> {
  const scope = await resolveMealPlanScope(options.accountSlug);
  if (scope.kind !== 'workspace') {
    throw new Error('Memories is a family workspace feature');
  }

  const client = getSupabaseServerClient();
  return assembleFamilyMemoriesPage(client, {
    accountId: scope.accountId,
    accountSlug: scope.accountSlug,
    childId: options.childId,
    kind: options.kind,
  });
}

export const loadFamilyMemoriesPage = cache(loadFamilyMemoriesPageUncached);
