'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createInvoicesService } from './invoices.service';
import {
  createInvoiceCheckoutSessionByToken as createInvoiceCheckoutByToken,
} from './invoice-checkout';
import {
  GetInvoicePortalLinkSchema,
  CreateInvoiceCheckoutSessionByTokenSchema,
  CreateInvoiceSchema,
  DeleteInvoiceSchema,
  GetInvoiceForPortalSchema,
  GetInvoiceSchema,
  ListInvoicesSchema,
  SendInvoiceSchema,
  SetInvoiceStatusSchema,
  UpdateInvoiceSchema,
  UpsertInvoiceItemsSchema,
} from '../schema/invoices.schema';

function getService() {
  return createInvoicesService(getSupabaseServerClient());
}

export const listInvoices = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listInvoices(input);
  },
  { schema: ListInvoicesSchema },
);

export const getInvoice = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getInvoice(input);
  },
  { schema: GetInvoiceSchema },
);

export const createInvoice = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createInvoice(input);
  },
  { schema: CreateInvoiceSchema },
);

export const updateInvoice = enhanceAction(
  async (input) => {
    const service = getService();
    return service.updateInvoice(input);
  },
  { schema: UpdateInvoiceSchema },
);

export const deleteInvoice = enhanceAction(
  async (input) => {
    const service = getService();
    return service.deleteInvoice(input);
  },
  { schema: DeleteInvoiceSchema },
);

export const upsertInvoiceItems = enhanceAction(
  async (input) => {
    const service = getService();
    return service.upsertInvoiceItems(input);
  },
  { schema: UpsertInvoiceItemsSchema },
);

export const setInvoiceStatus = enhanceAction(
  async (input) => {
    const service = getService();
    return service.setInvoiceStatus(input);
  },
  { schema: SetInvoiceStatusSchema },
);

export const sendInvoice = enhanceAction(
  async (input) => {
    const service = getService();
    return service.sendInvoice(input);
  },
  { schema: SendInvoiceSchema },
);

export const getInvoiceForPortal = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getInvoiceForPortal(input);
  },
  { schema: GetInvoiceForPortalSchema },
);

export const createInvoiceCheckoutSessionByToken = enhanceAction(
  async (input) => {
    return createInvoiceCheckoutByToken(input.token);
  },
  { schema: CreateInvoiceCheckoutSessionByTokenSchema },
);

export const getInvoicePortalLink = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getInvoicePortalLink(input);
  },
  { schema: GetInvoicePortalLinkSchema },
);
