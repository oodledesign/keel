import { z } from 'zod';

export const ListWorkspaceRetainersSchema = z.object({
  accountId: z.string().uuid(),
});

export type ListWorkspaceRetainersInput = z.infer<
  typeof ListWorkspaceRetainersSchema
>;
