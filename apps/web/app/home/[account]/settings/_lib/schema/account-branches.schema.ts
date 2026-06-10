import { z } from 'zod';

const branchFields = {
  name: z.string().trim().min(1, 'Branch name is required').max(120),
  address: z.string().trim().max(1000).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().max(320).optional().nullable(),
  is_default: z.boolean().optional(),
};

export const saveAccountBranchSchema = z.object({
  accountId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  ...branchFields,
});

export const deleteAccountBranchSchema = z.object({
  accountId: z.string().uuid(),
  branchId: z.string().uuid(),
});

export const saveAccountBranchesSchema = z.object({
  accountId: z.string().uuid(),
  branches: z
    .array(
      z.object({
        id: z.string().uuid().optional().nullable(),
        ...branchFields,
      }),
    )
    .max(50),
});
