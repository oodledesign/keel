import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import {
  type BrochureMappedPassage,
  brochureOriginForMode,
} from '~/lib/building-surveyor/brochure-import';
import {
  extractBrochurePdfText,
  mapBrochureTextToSections,
} from '~/lib/building-surveyor/brochure-import.server';
import { surveySectionByKey } from '~/lib/building-surveyor/survey-section-catalogue';
import type { Database } from '~/lib/database.types';

import type {
  ApplySurveyBrochureInput,
  PreviewSurveyBrochureInput,
} from '../schema/survey-brochure.schema';
import { createSurveyCaptureService } from './survey-capture.service';

export function createSurveyBrochureService(client: SupabaseClient<Database>) {
  return new SurveyBrochureService(client);
}

class SurveyBrochureService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private capture() {
    return createSurveyCaptureService(this.client);
  }

  async preview(input: PreviewSurveyBrochureInput): Promise<{
    passages: BrochureMappedPassage[];
    extractedChars: number;
  }> {
    const capture = this.capture();
    await capture.assertBuildingSurveyorAccount(input.accountId);
    await capture.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await capture.getSurvey(input.accountId, input.proposalId);

    if (
      !input.filePath.startsWith(`${input.accountId}/`) ||
      input.filePath.includes('..')
    ) {
      throw new Error('Invalid file path');
    }

    const admin = getSupabaseServerAdminClient();
    const { data: file, error } = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .download(input.filePath);
    if (error || !file) {
      throw new Error(error?.message ?? 'Could not read the uploaded PDF');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const brochureText = await extractBrochurePdfText(buffer);
    if (brochureText.length < 40) {
      throw new Error(
        'Could not extract enough text from that PDF. Try a text-based brochure.',
      );
    }

    const passages = await mapBrochureTextToSections({
      brochureText,
      accountId: input.accountId,
      supabase: this.client,
    });

    return { passages, extractedChars: brochureText.length };
  }

  async apply(input: ApplySurveyBrochureInput) {
    const capture = this.capture();
    await capture.assertBuildingSurveyorAccount(input.accountId);
    await capture.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await capture.getSurvey(input.accountId, input.proposalId);

    const { data: maxRow } = await this.db
      .from('survey_observations')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSort = Number(maxRow?.sort_order ?? -1) + 1;
    const created = [];
    for (const choice of input.choices) {
      if (choice.mode === 'skip') continue;
      const body =
        choice.mode === 'exact'
          ? choice.exactText.trim()
          : choice.rewrittenText.trim();
      if (!body) continue;

      const section = surveySectionByKey(choice.sectionKey);
      const { data, error } = await this.db
        .from('survey_observations')
        .insert({
          account_id: input.accountId,
          proposal_id: input.proposalId,
          section_key: choice.sectionKey,
          rics_code: section?.ricsCode ?? choice.sectionKey,
          body,
          origin: brochureOriginForMode(choice.mode),
          origin_doc_id: input.originDocId ?? null,
          origin_body: body,
          sort_order: nextSort,
        })
        .select(
          'id, proposal_id, transcript_id, section_key, rics_code, condition_rating, body, source_body, cleanup_source, origin, origin_doc_id, origin_body, sort_order, created_at, updated_at',
        )
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? 'Could not save brochure note');
      }
      nextSort += 1;
      created.push(data);
    }

    return { createdCount: created.length };
  }
}
