'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';

import pathsConfig from '~/config/paths.config';
import {
  createApiToken,
  revokeApiToken,
} from '~/lib/api-tokens/api-tokens.service';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';

import {
  createApiTokenActionSchema,
  revokeApiTokenActionSchema,
} from '../schema/api-tokens.schema';

function revalidateSettings(accountSlug?: string) {
  if (!accountSlug?.trim()) return;
  revalidatePath(
    workAccountPath(pathsConfig.app.accountSettings, accountSlug.trim()),
    'page',
  );
}

export const createApiTokenAction = enhanceAction(
  async (input, user) => {
    const result = await createApiToken({
      accountId: input.accountId,
      userId: user.id,
      name: input.name,
    });

    revalidateSettings(input.accountSlug);

    return {
      token: result.token,
      rawToken: result.rawToken,
    };
  },
  { schema: createApiTokenActionSchema },
);

export const revokeApiTokenAction = enhanceAction(
  async (input, user) => {
    await revokeApiToken({
      accountId: input.accountId,
      userId: user.id,
      tokenId: input.tokenId,
    });

    revalidateSettings(input.accountSlug);
    return { ok: true as const };
  },
  { schema: revokeApiTokenActionSchema },
);
