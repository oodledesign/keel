import { z } from 'zod';

const PathsSchema = z.object({
  auth: z.object({
    signIn: z.string().min(1),
    signUp: z.string().min(1),
    verifyMfa: z.string().min(1),
    callback: z.string().min(1),
    passwordReset: z.string().min(1),
    passwordUpdate: z.string().min(1),
  }),
  app: z.object({
    home: z.string().min(1),
    personalAccountSettings: z.string().min(1),
    personalAccountAccessibility: z.string().min(1),
    personalAccountBilling: z.string().min(1),
    personalAccountBillingReturn: z.string().min(1),
    accountHome: z.string().min(1),
    accountSettings: z.string().min(1),
    accountBilling: z.string().min(1),
    accountMembers: z.string().min(1),
    accountClients: z.string().min(1),
    accountJobs: z.string().min(1),
    accountInvoices: z.string().min(1),
    accountInvoiceEdit: z.string().min(1),
    accountSchedule: z.string().min(1),
    accountJobDetail: z.string().min(1),
    accountJobEdit: z.string().min(1),
    accountBillingReturn: z.string().min(1),
    joinTeam: z.string().min(1),
    onboarding: z.string().min(1),
  }),
});

const pathsConfig = PathsSchema.parse({
  auth: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    verifyMfa: '/auth/verify',
    callback: '/auth/callback',
    passwordReset: '/auth/password-reset',
    passwordUpdate: '/update-password',
  },
  app: {
    home: '/home',
    personalAccountSettings: '/home/settings',
    personalAccountAccessibility: '/home/accessibility',
    personalAccountBilling: '/home/billing',
    personalAccountBillingReturn: '/home/billing/return',
    accountHome: '/home/[account]',
    accountSettings: `/home/[account]/settings`,
    accountBilling: `/home/[account]/billing`,
    accountMembers: `/home/[account]/members`,
    accountClients: `/home/[account]/clients`,
    accountJobs: `/home/[account]/jobs`,
    accountInvoices: `/home/[account]/invoices`,
    accountInvoiceEdit: `/home/[account]/invoices/[id]/edit`,
    accountSchedule: `/home/[account]/schedule`,
    accountJobDetail: `/home/[account]/jobs/[id]`,
    accountJobEdit: `/home/[account]/jobs/[id]/edit`,
    accountBillingReturn: `/home/[account]/billing/return`,
    joinTeam: '/join',
    onboarding: '/onboarding',
  },
} satisfies z.infer<typeof PathsSchema>);

export default pathsConfig;
