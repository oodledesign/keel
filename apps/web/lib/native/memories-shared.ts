import {
  type MemoryKind,
  isMemoryKind,
  todayIsoDate,
} from '~/home/[account]/memories/_lib/memory-constants';
import type {
  FamilyMemoriesPageData,
  FamilyMemoryChild,
  FamilyMemoryItem,
} from '~/home/[account]/memories/_lib/server/family-memories.loader';

import { NativeHttpError } from './http';
import type { NativeWorkspace } from './workspace-shared';

export type NativeMemoryKind = MemoryKind;

export type NativeMemoryChild = {
  id: string;
  account_id: string;
  full_name: string;
  display_name: string;
  nickname: string | null;
  relationship_label: string | null;
  is_child: boolean;
  date_of_birth: string | null;
  avatar_url: string | null;
  age_label: string | null;
  memory_count: number;
};

export type NativeMemoryLinkedChild = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_label: string | null;
};

export type NativeMemoryMedia = {
  id: string;
  title: string;
  mime_type: string | null;
  url: string | null;
  kind: 'image' | 'video' | 'audio' | null;
};

export type NativeMemoryItem = {
  id: string;
  title: string;
  content: string;
  occurred_on: string;
  kind: NativeMemoryKind | null;
  child_ids: string[];
  children: NativeMemoryLinkedChild[];
  media: NativeMemoryMedia[];
  created_at: string;
  updated_at: string;
};

export type NativeMemoriesPayload = {
  account_id: string;
  account_slug: string;
  people: NativeMemoryChild[];
  children: NativeMemoryChild[];
  memories: NativeMemoryItem[];
};

export function isFamilyMemoriesWorkspace(workspace: NativeWorkspace) {
  return !workspace.isPersonal && workspace.profile === 'family';
}

export function requireFamilyMemoriesWorkspace(workspace: NativeWorkspace) {
  if (!isFamilyMemoriesWorkspace(workspace)) {
    throw new NativeHttpError(403, 'Memories is a family workspace feature');
  }
}

export function parseNativeMemoryKind(
  value: string | null | undefined,
): NativeMemoryKind | null {
  if (value == null || value === '') return null;
  if (!isMemoryKind(value)) {
    throw new NativeHttpError(400, 'kind must be a memory category');
  }
  return value;
}

export function parseNativeOccurredOn(
  value: string | null | undefined,
): string {
  if (value == null || value === '') return todayIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new NativeHttpError(400, 'occurred_at must be YYYY-MM-DD');
  }
  return value;
}

export function parseNativeBirthday(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value == null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new NativeHttpError(400, 'date_of_birth must be YYYY-MM-DD');
  }
  return value;
}

export function toNativeMemoryChild(
  child: FamilyMemoryChild,
): NativeMemoryChild {
  return {
    id: child.id,
    account_id: child.accountId,
    full_name: child.fullName,
    display_name: child.display_name,
    nickname: child.nickname,
    relationship_label: child.relationshipLabel,
    is_child: child.is_child,
    date_of_birth: child.date_of_birth,
    avatar_url: child.avatarUrl ?? child.avatar_url,
    age_label: child.ageLabel,
    memory_count: child.memoryCount,
  };
}

export function toNativeMemoryItem(memory: FamilyMemoryItem): NativeMemoryItem {
  return {
    id: memory.id,
    title: memory.title,
    content: memory.content,
    occurred_on: memory.occurredOn,
    kind: memory.kind,
    child_ids: memory.childIds,
    children: memory.children.map((child) => ({
      id: child.id,
      display_name: child.display_name,
      avatar_url: child.avatarUrl,
      age_label: child.ageLabel ?? null,
    })),
    media: memory.media.map((item) => ({
      id: item.id,
      title: item.title,
      mime_type: item.mimeType,
      url: item.url,
      kind: item.kind,
    })),
    created_at: memory.createdAt,
    updated_at: memory.updatedAt,
  };
}

export function toNativeMemoriesPayload(
  data: FamilyMemoriesPageData,
): NativeMemoriesPayload {
  return {
    account_id: data.accountId,
    account_slug: data.accountSlug,
    people: data.people.map(toNativeMemoryChild),
    children: data.children.map(toNativeMemoryChild),
    memories: data.memories.map(toNativeMemoryItem),
  };
}
