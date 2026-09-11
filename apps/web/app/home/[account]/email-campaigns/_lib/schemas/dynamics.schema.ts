import { z } from 'zod';

import {
  DYNAMICS_COMPANY_STRATEGIES,
  DYNAMICS_CONSENT_MODES,
  DYNAMICS_ENTITIES,
} from '~/lib/dynamics/types';

const LogicalNameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, 'Use a Dataverse logical name');

export const DynamicsFieldMappingSchema = z.object({
  email: LogicalNameSchema,
  firstName: LogicalNameSchema,
  lastName: LogicalNameSchema,
  company: LogicalNameSchema.nullable(),
  companyStrategy: z.enum(DYNAMICS_COMPANY_STRATEGIES),
  consentMode: z.enum(DYNAMICS_CONSENT_MODES),
  consentFields: z.array(LogicalNameSchema).min(1).max(8),
  extraConsentField: LogicalNameSchema.nullable(),
});

export const SaveDynamicsConnectionSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  syncEnabled: z.boolean(),
  tenantId: z.string().uuid('Tenant ID must be a GUID'),
  environmentUrl: z.string().trim().url(),
  applicationId: z.string().uuid('Application ID must be a GUID'),
  clientSecret: z.string().max(400).optional().nullable(),
  entity: z.enum(DYNAMICS_ENTITIES),
  fieldMapping: DynamicsFieldMappingSchema,
});

export const DynamicsAccountSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
});
