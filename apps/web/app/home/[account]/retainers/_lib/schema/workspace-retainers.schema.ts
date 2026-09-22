import { z } from 'zod';

export const ListWorkspaceRetainersSchema = z.object({
  accountId: z.string().uuid(),
});

export type ListWorkspaceRetainersInput = z.infer<
  typeof ListWorkspaceRetainersSchema
>;

export const LinkWorkspaceRetainerToProjectSchema = z.object({
  accountId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export type LinkWorkspaceRetainerToProjectInput = z.infer<
  typeof LinkWorkspaceRetainerToProjectSchema
>;
