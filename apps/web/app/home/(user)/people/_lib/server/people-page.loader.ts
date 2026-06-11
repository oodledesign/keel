import 'server-only';

import { cache } from 'react';

import { createAccountsApi } from '@kit/accounts/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  createPeopleService,
  type PersonListItem,
  type PersonProfile,
} from './people.service';

function resolveViewerName(
  user: { email?: string | null; user_metadata?: Record<string, unknown> },
) {
  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim());

  if (displayName) return displayName;

  const emailLocal = user.email?.split('@')[0]?.trim();
  return emailLocal || 'You';
}

function resolveViewerAvatar(
  workspace: { picture_url?: string | null },
  user: { user_metadata?: Record<string, unknown> },
) {
  const meta = user.user_metadata ?? {};
  return (
    workspace.picture_url?.trim() ||
    (typeof meta.picture_url === 'string' && meta.picture_url.trim()) ||
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    null
  );
}

export type PeopleViewer = {
  name: string;
  avatarUrl: string | null;
};

export type PeopleListPageData = {
  people: PersonListItem[];
  viewer: PeopleViewer;
};

export type PersonProfilePageData = {
  person: PersonProfile;
};

export const loadPeopleListPageData = cache(async (): Promise<PeopleListPageData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const api = createAccountsApi(client);
  const workspace = await api.getAccountWorkspace();
  const service = createPeopleService(client);
  const people = await service.listPeople(user.id);

  return {
    people,
    viewer: {
      name: resolveViewerName(user),
      avatarUrl: resolveViewerAvatar(
        workspace as { picture_url?: string | null },
        user,
      ),
    },
  };
});

export const loadPersonProfilePageData = cache(
  async (personId: string): Promise<PersonProfilePageData | null> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const service = createPeopleService(client);
    const person = await service.getPerson(user.id, personId);
    if (!person) return null;
    return { person };
  },
);
