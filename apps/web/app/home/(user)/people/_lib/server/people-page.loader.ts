import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  createPeopleService,
  type PersonListItem,
  type PersonProfile,
} from './people.service';

export type PeopleListPageData = {
  people: PersonListItem[];
};

export type PersonProfilePageData = {
  person: PersonProfile;
};

export const loadPeopleListPageData = cache(async (): Promise<PeopleListPageData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const service = createPeopleService(client);
  const people = await service.listPeople(user.id);
  return { people };
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
