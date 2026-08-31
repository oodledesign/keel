import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type PersonListItem,
  type PersonProfile,
  createPeopleService,
} from '~/home/(user)/people/_lib/server/people.service';

import { NativeHttpError } from './http';
import type { NativeWorkspace } from './workspace';

function mapPersonListItem(person: PersonListItem) {
  return {
    id: person.id,
    full_name: person.full_name,
    nickname: person.nickname,
    relationship_label: person.relationship_label,
    email: person.email,
    phone: person.phone,
    avatar_url: person.avatar_url,
    circle_tier: person.circle_tier,
    catchup_overdue: person.catchupOverdue,
    birthday_this_week: person.birthdayThisWeek,
    days_until_birthday: person.daysUntilBirthday,
  };
}

function mapPersonProfile(person: PersonProfile) {
  return {
    ...mapPersonListItem({
      ...person,
      birthdayThisWeek:
        person.daysUntilBirthday !== null &&
        person.daysUntilBirthday >= 0 &&
        person.daysUntilBirthday <= 7,
    }),
    general_notes: person.general_notes,
    catchup_cadence_days: person.catchup_cadence_days,
    last_catchup_on: person.last_catchup_on,
    next_catchup_due_on: person.nextCatchupDueOn,
    dates: person.dates,
    gift_ideas: person.giftIdeas,
    catchups: person.catchups,
    notes: person.notes,
  };
}

export async function listNativePeople(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
) {
  const service = createPeopleService(client);
  const people = await service.listPeople(userId);

  return people
    .filter((person) => person.account_id === workspace.id)
    .map(mapPersonListItem);
}

export async function getNativePerson(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
  personId: string,
) {
  const service = createPeopleService(client);
  const person = await service.getPerson(userId, personId);

  if (!person || person.account_id !== workspace.id) {
    throw new NativeHttpError(404, 'Person not found');
  }

  return mapPersonProfile(person);
}
