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

function revalidateSettings(input: {
  accountSlug?: string;
  personal?: boolean;
}) {
  if (input.personal) {
    revalidatePath(pathsConfig.app.personalAccountSettings, 'page');
    return;
  }

  const slug = input.accountSlug?.trim();
  if (!slug) return;

  revalidatePath(workAccountPath(pathsConfig.app.accountSettings, slug), 'page');
}

export const createApiTokenAction = enhanceAction(
  async (input, user) => {
    const result = await createApiToken({
      accountId: input.accountId,
      userId: user.id,
      name: input.name,
    });

    revalidateSettings({
      accountSlug: input.accountSlug,
      personal: input.personal,
    });

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

    revalidateSettings({
      accountSlug: input.accountSlug,
      personal: input.personal,
    });
    return { ok: true as const };
  },
  { schema: revokeApiTokenActionSchema },
);
