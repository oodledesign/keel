'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  CreateCatchupSchema,
  CreateGiftIdeaSchema,
  CreatePersonDateSchema,
  CreatePersonNoteSchema,
  CreatePersonSchema,
  DeleteCatchupSchema,
  DeleteGiftIdeaSchema,
  DeletePersonDateSchema,
  DeletePersonNoteSchema,
  DeletePersonSchema,
  UpdateCatchupSchema,
  UpdateGiftIdeaSchema,
  UpdatePersonDateSchema,
  UpdatePersonNoteSchema,
  UpdatePersonSchema,
} from '../schema/people.schema';
import {
  createPeopleService,
  resolvePersonalAccountContext,
} from '../server/people.service';

function revalidatePeople(personId?: string) {
  revalidatePath('/app/people');
  revalidatePath('/home/people');
  revalidatePath('/app');
  revalidatePath('/home');
  if (personId) {
    revalidatePath(`/app/people/${personId}`);
    revalidatePath(`/home/people/${personId}`);
  }
}

function actionError(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

export async function createPersonAction(input: unknown) {
  try {
    const parsed = CreatePersonSchema.parse(input);
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const { accountId } = await resolvePersonalAccountContext(client, user.id);
    const service = createPeopleService(client);
    const id = await service.createPerson(user.id, accountId, {
      fullName: parsed.fullName,
      nickname: parsed.nickname,
      relationshipLabel: parsed.relationshipLabel,
      email: parsed.email || null,
      phone: parsed.phone,
      generalNotes: parsed.generalNotes,
      catchupCadenceDays: parsed.catchupCadenceDays ?? null,
    });
    revalidatePeople(id);
    return { success: true as const, id, error: null };
  } catch (err) {
    return { success: false as const, id: null, error: actionError(err) };
  }
}

export async function updatePersonAction(input: unknown) {
  try {
    const parsed = UpdatePersonSchema.parse(input);
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.updatePerson(user.id, {
      id: parsed.id,
      fullName: parsed.fullName,
      nickname: parsed.nickname,
      relationshipLabel: parsed.relationshipLabel,
      email: parsed.email || null,
      phone: parsed.phone,
      generalNotes: parsed.generalNotes,
      catchupCadenceDays: parsed.catchupCadenceDays ?? null,
    });
    revalidatePeople(parsed.id);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function deletePersonAction(input: unknown) {
  try {
    const parsed = DeletePersonSchema.parse(input);
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.deletePerson(user.id, parsed.id);
    revalidatePeople();
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function createPersonDateAction(input: unknown) {
  try {
    const parsed = CreatePersonDateSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    const id = await service.createDate({
      personId: parsed.personId,
      kind: parsed.kind,
      month: parsed.month,
      day: parsed.day,
      yearOptional: parsed.yearOptional,
      label: parsed.label,
      notes: parsed.notes,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, id, error: null };
  } catch (err) {
    return { success: false as const, id: null, error: actionError(err) };
  }
}

export async function updatePersonDateAction(input: unknown) {
  try {
    const parsed = UpdatePersonDateSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.updateDate({
      id: parsed.id,
      kind: parsed.kind,
      month: parsed.month,
      day: parsed.day,
      yearOptional: parsed.yearOptional,
      label: parsed.label,
      notes: parsed.notes,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function deletePersonDateAction(input: unknown) {
  try {
    const parsed = DeletePersonDateSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.deleteDate(parsed.id);
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function createGiftIdeaAction(input: unknown) {
  try {
    const parsed = CreateGiftIdeaSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    const id = await service.createGiftIdea({
      personId: parsed.personId,
      title: parsed.title,
      notes: parsed.notes,
      url: parsed.url || null,
      occasion: parsed.occasion,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, id, error: null };
  } catch (err) {
    return { success: false as const, id: null, error: actionError(err) };
  }
}

export async function updateGiftIdeaAction(input: unknown) {
  try {
    const parsed = UpdateGiftIdeaSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.updateGiftIdea({
      id: parsed.id,
      title: parsed.title,
      notes: parsed.notes,
      url: parsed.url || null,
      occasion: parsed.occasion,
      purchased: parsed.purchased,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function deleteGiftIdeaAction(input: unknown) {
  try {
    const parsed = DeleteGiftIdeaSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.deleteGiftIdea(parsed.id);
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function createCatchupAction(input: unknown) {
  try {
    const parsed = CreateCatchupSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    const id = await service.createCatchup({
      personId: parsed.personId,
      metOn: parsed.metOn,
      location: parsed.location,
      conversationNotes: parsed.conversationNotes,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, id, error: null };
  } catch (err) {
    return { success: false as const, id: null, error: actionError(err) };
  }
}

export async function updateCatchupAction(input: unknown) {
  try {
    const parsed = UpdateCatchupSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.updateCatchup({
      id: parsed.id,
      personId: parsed.personId,
      metOn: parsed.metOn,
      location: parsed.location,
      conversationNotes: parsed.conversationNotes,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function deleteCatchupAction(input: unknown) {
  try {
    const parsed = DeleteCatchupSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.deleteCatchup(parsed.id, parsed.personId);
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function createPersonNoteAction(input: unknown) {
  try {
    const parsed = CreatePersonNoteSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    const id = await service.createNote({
      personId: parsed.personId,
      body: parsed.body,
    });
    revalidatePeople(parsed.personId);
    return { success: true as const, id, error: null };
  } catch (err) {
    return { success: false as const, id: null, error: actionError(err) };
  }
}

export async function updatePersonNoteAction(input: unknown) {
  try {
    const parsed = UpdatePersonNoteSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.updateNote({ id: parsed.id, body: parsed.body });
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function deletePersonNoteAction(input: unknown) {
  try {
    const parsed = DeletePersonNoteSchema.parse(input);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const service = createPeopleService(client);
    await service.deleteNote(parsed.id);
    revalidatePeople(parsed.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}

export async function toggleGiftPurchasedAction(input: {
  id: string;
  personId: string;
  purchased: boolean;
}) {
  try {
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();
    const { data: gift, error: fetchErr } = await client
      .from('personal_person_gift_ideas')
      .select('title, notes, url, occasion')
      .eq('id', input.id)
      .maybeSingle();

    if (fetchErr || !gift) {
      return { success: false as const, error: 'Gift idea not found' };
    }

    const g = gift as {
      title: string;
      notes: string | null;
      url: string | null;
      occasion: string | null;
    };

    const service = createPeopleService(client);
    await service.updateGiftIdea({
      id: input.id,
      title: g.title,
      notes: g.notes,
      url: g.url,
      occasion: g.occasion,
      purchased: input.purchased,
    });
    revalidatePeople(input.personId);
    return { success: true as const, error: null };
  } catch (err) {
    return { success: false as const, error: actionError(err) };
  }
}
