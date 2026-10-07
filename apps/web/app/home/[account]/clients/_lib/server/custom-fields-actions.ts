'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CONTACT_CUSTOM_FIELD_TYPES } from '~/lib/contacts/custom-fields';
import {
  createContactCustomField,
  deleteContactCustomField,
  getContactCustomValues,
  listContactCustomFields,
  setContactCustomValues,
  updateContactCustomField,
} from '~/lib/contacts/custom-fields.service';

function db() {
  return getSupabaseServerClient();
}

export const loadContactCustomFieldsAction = enhanceAction(
  async (data) => {
    const [definitions, values] = await Promise.all([
      listContactCustomFields(db(), data.accountId),
      data.clientId
        ? getContactCustomValues(db(), {
            accountId: data.accountId,
            clientId: data.clientId,
          })
        : Promise.resolve({}),
    ]);
    return { definitions, values };
  },
  {
    auth: true,
    schema: z.object({
      accountId: z.string().uuid(),
      clientId: z.string().uuid().optional(),
    }),
  },
);

export const createContactCustomFieldAction = enhanceAction(
  async (data) => {
    const definition = await createContactCustomField(db(), data);
    return { definition };
  },
  {
    auth: true,
    schema: z.object({
      accountId: z.string().uuid(),
      label: z.string().min(1).max(80),
      fieldType: z.enum(CONTACT_CUSTOM_FIELD_TYPES),
      options: z.array(z.string().max(80)).max(40).optional(),
    }),
  },
);

export const updateContactCustomFieldAction = enhanceAction(
  async (data) => {
    await updateContactCustomField(db(), data);
    return { success: true as const };
  },
  {
    auth: true,
    schema: z.object({
      accountId: z.string().uuid(),
      id: z.string().uuid(),
      label: z.string().min(1).max(80),
      options: z.array(z.string().max(80)).max(40).optional(),
    }),
  },
);

export const deleteContactCustomFieldAction = enhanceAction(
  async (data) => {
    await deleteContactCustomField(db(), data);
    return { success: true as const };
  },
  {
    auth: true,
    schema: z.object({
      accountId: z.string().uuid(),
      id: z.string().uuid(),
    }),
  },
);

export const saveContactCustomValuesAction = enhanceAction(
  async (data) => {
    const values = await setContactCustomValues(db(), data);
    return { values };
  },
  {
    auth: true,
    schema: z.object({
      accountId: z.string().uuid(),
      clientId: z.string().uuid(),
      values: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      ),
    }),
  },
);
