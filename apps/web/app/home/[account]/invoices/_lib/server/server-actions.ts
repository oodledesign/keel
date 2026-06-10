'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  ArchiveInvoiceSchema,
  CreateInvoiceCheckoutSessionByTokenSchema,
  CreateInvoiceSchema,
  DeleteInvoiceSchema,
  DuplicateInvoiceSchema,
  GetInvoiceForPortalSchema,
  GetInvoicePortalLinkSchema,
  GetInvoiceSchema,
  GetInvoiceSummarySchema,
  ListInvoicesSchema,
  ListRecurringSeriesSchema,
  ResendInvoiceSchema,
  SavePaymentSettingsSchema,
  SendInvoiceSchema,
  SetInvoiceStatusSchema,
  UpdateInvoiceSchema,
  UpdateRecurringSeriesStatusSchema,
  UpsertInvoiceItemsSchema,
  UpsertRecurringSeriesSchema,
} from '../schema/invoices.schema';
import {
  createInvoiceCheckoutSessionByToken as createInvoiceCheckoutByToken,
} from './invoice-checkout';
import { createInvoicePaymentSettingsService } from './invoice-payment-settings.service';
import {
  archiveInvoice,
  duplicateInvoice,
  getInvoiceSummary,
  getInvoiceTabCounts,
  listRecurringSeries,
  resendInvoice,
  updateRecurringSeriesStatus,
  upsertRecurringSeries,
  voidInvoice,
} from './invoice-v2.server';
import { createInvoicesService } from './invoices.service';

function getService() {
  return createInvoicesService(getSupabaseServerClient());
}

function getPaymentSettingsService() {
  return createInvoicePaymentSettingsService(getSupabaseServerClient());
}

export const listInvoices = enhanceAction(
  async (input) => getService().listInvoices(input),
  { schema: ListInvoicesSchema },
);

export const getInvoice = enhanceAction(
  async (input) => getService().getInvoice(input),
  { schema: GetInvoiceSchema },
);

export const createInvoice = enhanceAction(
  async (input) => getService().createInvoice(input),
  { schema: CreateInvoiceSchema },
);

export const updateInvoice = enhanceAction(
  async (input) => getService().updateInvoice(input),
  { schema: UpdateInvoiceSchema },
);

export const deleteInvoice = enhanceAction(
  async (input) => getService().deleteInvoice(input),
  { schema: DeleteInvoiceSchema },
);

export const upsertInvoiceItems = enhanceAction(
  async (input) => getService().upsertInvoiceItems(input),
  { schema: UpsertInvoiceItemsSchema },
);

export const setInvoiceStatus = enhanceAction(
  async (input) => getService().setInvoiceStatus(input),
  { schema: SetInvoiceStatusSchema },
);

export const sendInvoice = enhanceAction(
  async (input) => getService().sendInvoice(input),
  { schema: SendInvoiceSchema },
);

export const getInvoiceForPortal = enhanceAction(
  async (input) => getService().getInvoiceForPortal(input),
  { schema: GetInvoiceForPortalSchema },
);

export const createInvoiceCheckoutSessionByToken = enhanceAction(
  async (input) =>
    createInvoiceCheckoutByToken(input.token, {
      payDepositOnly: input.pay_deposit_only,
    }),
  { schema: CreateInvoiceCheckoutSessionByTokenSchema },
);

export const getInvoicePortalLink = enhanceAction(
  async (input) => getService().getInvoicePortalLink(input),
  { schema: GetInvoicePortalLinkSchema },
);

export const duplicateInvoiceAction = enhanceAction(
  async (input) => duplicateInvoice(input.accountId, input.invoiceId),
  { schema: DuplicateInvoiceSchema },
);

export const archiveInvoiceAction = enhanceAction(
  async (input) => archiveInvoice(input.accountId, input.invoiceId, input.archived),
  { schema: ArchiveInvoiceSchema },
);

export const resendInvoiceAction = enhanceAction(
  async (input) => resendInvoice(input.accountId, input.invoiceId),
  { schema: ResendInvoiceSchema },
);

export const voidInvoiceAction = enhanceAction(
  async (input) => voidInvoice(input.accountId, input.invoiceId),
  { schema: DuplicateInvoiceSchema },
);

export const getInvoiceSummaryAction = enhanceAction(
  async (input) => getInvoiceSummary(input.accountId, input.period),
  { schema: GetInvoiceSummarySchema },
);

export const getInvoiceTabCountsAction = enhanceAction(
  async (input) => getInvoiceTabCounts(input.accountId),
  { schema: ListInvoicesSchema.pick({ accountId: true }) },
);

export const listRecurringSeriesAction = enhanceAction(
  async (input) => listRecurringSeries(input.accountId),
  { schema: ListRecurringSeriesSchema },
);

export const upsertRecurringSeriesAction = enhanceAction(
  async (input) => upsertRecurringSeries(input),
  { schema: UpsertRecurringSeriesSchema },
);

export const updateRecurringSeriesStatusAction = enhanceAction(
  async (input) =>
    updateRecurringSeriesStatus(input.accountId, input.seriesId, input.status),
  { schema: UpdateRecurringSeriesStatusSchema },
);

export const getPaymentSettingsAction = enhanceAction(
  async (input) => getPaymentSettingsService().getSettings(input.accountId),
  { schema: SavePaymentSettingsSchema.pick({ accountId: true }) },
);

export const savePaymentSettingsAction = enhanceAction(
  async (input) => getPaymentSettingsService().saveSettings(input),
  { schema: SavePaymentSettingsSchema },
);

export const disconnectStripeAction = enhanceAction(
  async (input) => getPaymentSettingsService().disconnectStripe(input.accountId),
  { schema: SavePaymentSettingsSchema.pick({ accountId: true }) },
);
