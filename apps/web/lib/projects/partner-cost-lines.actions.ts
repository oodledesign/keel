'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createPartnerCostLinesService } from '~/lib/projects/partner-cost-lines.service';

const MoneyPenceSchema = z.number().int().nonnegative().nullable().optional();

const PartnerContextSchema = z.object({
  accountSlug: z.string().min(1),
  shareId: z.string().uuid(),
  projectId: z.string().uuid(),
  partnerAccountId: z.string().uuid(),
});

const ListPartnerSchema = PartnerContextSchema;

const ListHostSchema = z.object({
  ownerAccountId: z.string().uuid(),
  projectId: z.string().uuid(),
});

const CreateSchema = PartnerContextSchema.extend({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  estimatePence: MoneyPenceSchema,
  actualPence: MoneyPenceSchema,
});

const UpdateSchema = PartnerContextSchema.extend({
  lineId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  estimatePence: MoneyPenceSchema,
  actualPence: MoneyPenceSchema,
});

const LineIdPartnerSchema = PartnerContextSchema.extend({
  lineId: z.string().uuid(),
});

const ReviewSchema = z.object({
  lineId: z.string().uuid(),
  ownerAccountId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(2000).nullable().optional(),
  accountSlug: z.string().min(1),
  projectId: z.string().uuid(),
});

function revalidatePartnerPaths(input: {
  accountSlug?: string;
  shareId?: string;
  projectId?: string;
}) {
  if (input.accountSlug && input.shareId) {
    revalidatePath(
      `/home/${input.accountSlug}/shared-clients/${input.shareId}`,
    );
    revalidatePath(
      `/app/${input.accountSlug}/shared-clients/${input.shareId}`,
    );
    if (input.projectId) {
      revalidatePath(
        `/home/${input.accountSlug}/shared-clients/${input.shareId}/projects/${input.projectId}`,
      );
      revalidatePath(
        `/app/${input.accountSlug}/shared-clients/${input.shareId}/projects/${input.projectId}`,
      );
    }
  }
  if (input.accountSlug && input.projectId) {
    revalidatePath(`/home/${input.accountSlug}/projects/${input.projectId}`);
    revalidatePath(`/app/${input.accountSlug}/projects/${input.projectId}`);
  }
}

export const listPartnerCostLinesAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    return service.listForPartner({
      shareId: data.shareId,
      projectId: data.projectId,
      partnerAccountId: data.partnerAccountId,
    });
  },
  { schema: ListPartnerSchema, auth: true },
);

export const listHostPartnerCostLinesAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    return service.listForHost(data);
  },
  { schema: ListHostSchema, auth: true },
);

export const createPartnerCostLineAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    const line = await service.create({
      shareId: data.shareId,
      projectId: data.projectId,
      partnerAccountId: data.partnerAccountId,
      userId: user.id,
      title: data.title,
      description: data.description ?? null,
      estimatePence: data.estimatePence ?? null,
      actualPence: data.actualPence ?? null,
    });
    revalidatePartnerPaths(data);
    return line;
  },
  { schema: CreateSchema, auth: true },
);

export const updatePartnerCostLineAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    const line = await service.update({
      lineId: data.lineId,
      partnerAccountId: data.partnerAccountId,
      userId: user.id,
      title: data.title,
      description: data.description,
      estimatePence: data.estimatePence,
      actualPence: data.actualPence,
    });
    revalidatePartnerPaths(data);
    return line;
  },
  { schema: UpdateSchema, auth: true },
);

export const deletePartnerCostLineAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    await service.delete({
      lineId: data.lineId,
      partnerAccountId: data.partnerAccountId,
    });
    revalidatePartnerPaths(data);
    return { ok: true as const };
  },
  { schema: LineIdPartnerSchema, auth: true },
);

export const submitPartnerCostLineAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    const line = await service.submit({
      lineId: data.lineId,
      partnerAccountId: data.partnerAccountId,
      userId: user.id,
    });
    revalidatePartnerPaths(data);
    return line;
  },
  { schema: LineIdPartnerSchema, auth: true },
);

export const reviewPartnerCostLineAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const service = createPartnerCostLinesService(client);
    const line = await service.review({
      lineId: data.lineId,
      ownerAccountId: data.ownerAccountId,
      userId: user.id,
      status: data.status,
      reviewNote: data.reviewNote ?? null,
    });
    revalidatePartnerPaths({
      accountSlug: data.accountSlug,
      projectId: data.projectId,
    });
    return line;
  },
  { schema: ReviewSchema, auth: true },
);
