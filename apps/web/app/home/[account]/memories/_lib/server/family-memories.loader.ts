import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { HouseholdMemberRow } from '~/home/(user)/life/family/_lib/schema/family-meal.schema';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';

import {
  type MemoryKind,
  formatChildAge,
  memoryKindFromTags,
  memoryOccurredOn,
} from '../memory-constants';
import type { FamilyMemoryMediaItem } from '../schemas/family-memories.schema';
import { createFamilyMemoriesService } from './family-memories.service';

export type FamilyMemoryChild = HouseholdMemberRow & {
  ageLabel: string | null;
  avatarUrl: string | null;
  memoryCount: number;
};

export type FamilyMemoryItem = {
  id: string;
  title: string;
  content: string;
  occurredOn: string;
  kind: MemoryKind | null;
  childIds: string[];
  children: Array<Pick<FamilyMemoryChild, 'id' | 'display_name' | 'avatarUrl'>>;
  media: FamilyMemoryMediaItem[];
  createdAt: string;
  updatedAt: string;
};

export type FamilyMemoriesPageData = {
  accountId: string;
  accountSlug: string;
  members: FamilyMemoryChild[];
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

function toChild(
  member: HouseholdMemberRow,
  memoryCount: number,
  avatarUrl: string | null,
): FamilyMemoryChild {
  return {
    ...member,
    is_child: Boolean(member.is_child),
    ageLabel: formatChildAge(member.date_of_birth),
    avatarUrl,
    memoryCount,
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
  const service = createFamilyMemoriesService(client);
  const members = await service.listHouseholdMembers(scope.accountId);
  const notes = await service.listMemoryNotes({
    accountId: scope.accountId,
    kind: options.kind,
  });
  const noteIds = notes.map((note) => note.id);
  const [links, docs] = await Promise.all([
    service.listChildLinks(noteIds),
    service.listDocsForNotes({
      accountId: scope.accountId,
      noteIds,
    }),
  ]);

  const linksByNote = new Map<string, string[]>();
  const counts = new Map<string, number>();
  for (const link of links) {
    const current = linksByNote.get(link.note_id) ?? [];
    current.push(link.household_member_id);
    linksByNote.set(link.note_id, current);
    counts.set(
      link.household_member_id,
      (counts.get(link.household_member_id) ?? 0) + 1,
    );
  }

  const docsByNote = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (!doc.note_id) continue;
    const current = docsByNote.get(doc.note_id) ?? [];
    current.push(doc);
    docsByNote.set(doc.note_id, current);
  }

  const avatarUrls = new Map<string, string | null>();
  await Promise.all(
    members.map(async (member) => {
      avatarUrls.set(member.id, await signStoragePath(member.avatar_path));
    }),
  );

  const enrichedMembers = members.map((member) =>
    toChild(
      member,
      counts.get(member.id) ?? 0,
      avatarUrls.get(member.id) ?? null,
    ),
  );

  const children = enrichedMembers.filter((member) => member.is_child);
  const memberById = new Map(
    enrichedMembers.map((member) => [member.id, member]),
  );

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
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      occurredOn: memoryOccurredOn(note.occurred_at, note.created_at),
      kind: memoryKindFromTags(note.tags),
      childIds,
      children: childIds
        .map((id) => memberById.get(id))
        .filter(Boolean)
        .map((child) => ({
          id: child!.id,
          display_name: child!.display_name,
          avatarUrl: child!.avatarUrl,
        })),
      media: (docsByNote.get(note.id) ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        mimeType: doc.mime_type,
        url: mediaByDocId.get(doc.id) ?? null,
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
    accountId: scope.accountId,
    accountSlug: scope.accountSlug,
    members: enrichedMembers,
    children,
    memories,
  };
}

export const loadFamilyMemoriesPage = cache(loadFamilyMemoriesPageUncached);
