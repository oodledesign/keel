import { z } from 'zod';

export const GetProjectPortalAccessSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const SetProjectPortalAccessSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  portalVisible: z.boolean().optional(),
  restrictContacts: z.boolean().optional(),
  contactIds: z.array(z.string().uuid()).max(200).optional(),
});

export type GetProjectPortalAccessInput = z.infer<
  typeof GetProjectPortalAccessSchema
>;
export type SetProjectPortalAccessInput = z.infer<
  typeof SetProjectPortalAccessSchema
>;

export type ProjectPortalContactOption = {
  id: string;
  fullName: string;
  email: string | null;
  role: string | null;
  isPrimary: boolean;
};

export type ProjectPortalAccess = {
  jobId: string;
  clientId: string | null;
  portalVisible: boolean;
  restrictContacts: boolean;
  contactIds: string[];
  contacts: ProjectPortalContactOption[];
};

export function summarizeProjectPortalAccess(
  access: ProjectPortalAccess | null,
) {
  if (!access?.portalVisible) return 'Not shared with portal';
  if (!access.restrictContacts) return 'Shared with all portal contacts';
  const count = access.contactIds.length;
  if (count === 0) return 'Shared — no contacts selected';
  if (count === 1) return 'Shared with 1 contact';
  return `Shared with ${count} contacts`;
}
