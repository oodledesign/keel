'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import {
  createKitEnvDeps,
  createKitEnvService,
  findWorkspaceRoot,
} from '@kit/mcp-server/env';

const Schema = z.object({
  name: z.string().min(1),
  value: z.string(),
  mode: z.enum(['development', 'production']),
});

export async function updateEnvironmentVariableAction(
  props: z.infer<typeof Schema>,
) {
  const { name, mode, value } = Schema.parse(props);

  const rootPath = findWorkspaceRoot(process.cwd());
  const service = createKitEnvService(createKitEnvDeps(rootPath));

  const result = await service.update({
    key: name,
    value,
    mode,
  });

  revalidatePath('/variables');

  return result;
}
