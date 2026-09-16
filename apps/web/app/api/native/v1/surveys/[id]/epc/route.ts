import { NextResponse } from 'next/server';

import { z } from 'zod';

import { createSurveyEpcService } from '~/home/[account]/surveys/_lib/server/survey-epc.service';
import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { parseNativeSurveyId } from '~/lib/native/surveys-shared';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  workspace: z.string().min(1),
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  uprn: z.string().max(20).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const parsed = BodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const service = createSurveyEpcService(auth.context.supabase);
    const result = await service.search({
      accountId: workspace.id,
      accountSlug: workspace.slug || workspace.id,
      proposalId: parseNativeSurveyId(id),
      address: parsed.data.address,
      postcode: parsed.data.postcode,
      uprn: parsed.data.uprn,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleNativeError(error, 'surveys');
  }
}
