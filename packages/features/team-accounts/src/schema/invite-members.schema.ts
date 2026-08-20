import { z } from 'zod';

const InviteSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().email(),
  role: z.string().min(1).max(100),
  projectId: z.string().uuid().optional().nullable(),
  /** Commercial Property: billable vs free support seat. Defaults to billable. */
  seatKind: z.enum(['billable', 'support']).optional().default('billable'),
});

export const InviteMembersSchema = z
  .object({
    invitations: InviteSchema.array().min(1).max(5),
  })
  .refine(
    (data) => {
      const emails = data.invitations.map((member) =>
        member.email.toLowerCase(),
      );

      const uniqueEmails = new Set(emails);

      return emails.length === uniqueEmails.size;
    },
    {
      message: 'Duplicate emails are not allowed',
      path: ['invitations'],
    },
  );
