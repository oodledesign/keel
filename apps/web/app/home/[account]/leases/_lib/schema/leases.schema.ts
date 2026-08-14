import { z } from 'zod';

import { LEASE_STATUSES } from '~/lib/commercial/commercial-constants';

export const TRANSACTION_KINDS = ['letting', 'sale'] as const;

export const ListLeasesSchema = z.object({
  accountId: z.string().uuid(),
});

export const CreateLeaseSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  propertyLabel: z.string().min(1),
  town: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  tenantName: z.string().optional().nullable(),
  headlineRentPsf: z.number().optional().nullable(),
  headlinePricePence: z.number().int().optional().nullable(),
  leaseStart: z.string().optional().nullable(),
  leaseEnd: z.string().optional().nullable(),
  status: z.enum(LEASE_STATUSES).default('active'),
  transactionKind: z.enum(TRANSACTION_KINDS).optional(),
  externalId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateLeaseSchema = CreateLeaseSchema.omit({ accountId: true })
  .partial()
  .extend({
    leaseId: z.string().uuid(),
    accountId: z.string().uuid(),
  });

export const DeleteLeaseSchema = z.object({
  leaseId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export type CreateLeaseInput = z.infer<typeof CreateLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof UpdateLeaseSchema>;
