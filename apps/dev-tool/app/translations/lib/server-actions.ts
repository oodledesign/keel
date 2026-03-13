'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { findWorkspaceRoot } from '@kit/mcp-server/env';
import {
  createKitTranslationsDeps,
  createKitTranslationsService,
} from '@kit/mcp-server/translations';

const Schema = z.object({
  locale: z.string().min(1),
  namespace: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
});

/**
 * Update a translation value in the specified locale and namespace.
 * @param props
 */
export async function updateTranslationAction(props: z.infer<typeof Schema>) {
  // Validate the input
  const { locale, namespace, key, value } = Schema.parse(props);
  const rootPath = findWorkspaceRoot(process.cwd());

  const service = createKitTranslationsService(
    createKitTranslationsDeps(rootPath),
  );

  try {
    const result = await service.update({ locale, namespace, key, value });

    revalidatePath(`/translations`);

    return result;
  } catch (error) {
    console.error('Failed to update translation:', error);
    throw new Error('Failed to update translation');
  }
}
