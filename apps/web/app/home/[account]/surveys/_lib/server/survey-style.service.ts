import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { distillSurveyStyleNotes } from '~/lib/ai/survey-style-distill';
import {
  extractStyleDocumentText,
  isSurveyStyleMime,
} from '~/lib/building-surveyor/style-extract';
import type { Database } from '~/lib/database.types';

import type {
  AddSurveyStyleExampleInput,
  DeleteSurveyStyleExampleInput,
  SurveyStyleExample,
  UpdateSurveyStyleExampleInput,
} from '../schema/survey-capture.schema';
import { createSurveyCaptureService } from './survey-capture.service';

const MAX_STYLE_EXAMPLES = 8;
const MAX_STYLE_FILE_BYTES = 15 * 1024 * 1024;

export function createSurveyStyleService(client: SupabaseClient<Database>) {
  return new SurveyStyleService(client);
}

class SurveyStyleService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private capture() {
    return createSurveyCaptureService(this.client);
  }

  async list(accountId: string): Promise<SurveyStyleExample[]> {
    const capture = this.capture();
    await capture.assertBuildingSurveyorAccount(accountId);
    return capture.listStyleExamples(accountId);
  }

  async add(input: AddSurveyStyleExampleInput) {
    const capture = this.capture();
    await capture.assertBuildingSurveyorAccount(input.accountId);
    const user = await capture.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );

    const existing = await capture.listStyleExamples(input.accountId);
    if (existing.length >= MAX_STYLE_EXAMPLES) {
      throw new Error(
        `You can keep up to ${MAX_STYLE_EXAMPLES} past reports for style. Remove one first.`,
      );
    }

    if (!isSurveyStyleMime(input.mimeType, input.originalFilename ?? '')) {
      throw new Error('Upload a PDF, Word document, HTML file, or text file.');
    }

    const admin = getSupabaseServerAdminClient();
    const { data: file, error: downloadError } = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .download(input.filePath);
    if (downloadError || !file) {
      throw new Error(
        downloadError?.message ?? 'Could not read the uploaded file',
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_STYLE_FILE_BYTES) {
      await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([input.filePath]);
      throw new Error('Style examples must be 15 MB or smaller.');
    }

    const extractedText = extractStyleDocumentText({
      filename: input.originalFilename || input.title,
      mimeType: input.mimeType,
      buffer,
    });

    const distilled = await distillSurveyStyleNotes({
      extractedText,
      accountId: input.accountId,
      supabase: this.client,
    });

    const { data, error } = await this.db
      .from('survey_style_examples')
      .insert({
        account_id: input.accountId,
        title: input.title.trim(),
        original_filename: input.originalFilename ?? null,
        mime_type: input.mimeType ?? null,
        storage_bucket: ACCOUNT_DOCS_BUCKET,
        file_path: input.filePath,
        extracted_text: extractedText || null,
        style_notes: distilled.styleNotes,
        created_by: user.id,
      })
      .select(
        'id, title, original_filename, mime_type, style_notes, extracted_text, created_at',
      )
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save the style example');
    }

    const row = data as Record<string, unknown>;
    return {
      example: {
        id: row.id as string,
        title: (row.title as string | null) ?? input.title,
        originalFilename: (row.original_filename as string | null) ?? null,
        mimeType: (row.mime_type as string | null) ?? null,
        styleNotes: (row.style_notes as string | null) ?? distilled.styleNotes,
        extractedPreview: extractedText.replace(/\s+/g, ' ').slice(0, 220),
        createdAt: row.created_at as string,
      } satisfies SurveyStyleExample,
      source: distilled.source,
      fallbackReason: distilled.fallbackReason,
    };
  }

  async update(input: UpdateSurveyStyleExampleInput) {
    const capture = this.capture();
    await capture.assertBuildingSurveyorAccount(input.accountId);
    await capture.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.styleNotes !== undefined) {
      payload.style_notes = input.styleNotes?.trim() || null;
    }
    if (Object.keys(payload).length === 0) {
      throw new Error('Nothing to update');
    }

    const { error } = await this.db
      .from('survey_style_examples')
      .update(payload)
      .eq('id', input.exampleId)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  async remove(input: DeleteSurveyStyleExampleInput) {
    const capture = this.capture();
    await capture.assertBuildingSurveyorAccount(input.accountId);
    await capture.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const { data, error: fetchError } = await this.db
      .from('survey_style_examples')
      .select('file_path, storage_bucket')
      .eq('id', input.exampleId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    const { error } = await this.db
      .from('survey_style_examples')
      .delete()
      .eq('id', input.exampleId)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);

    const path = (data as { file_path?: string | null } | null)?.file_path;
    const bucket =
      (data as { storage_bucket?: string | null } | null)?.storage_bucket ??
      ACCOUNT_DOCS_BUCKET;
    if (path) {
      const admin = getSupabaseServerAdminClient();
      await admin.storage.from(bucket).remove([path]);
    }

    return { ok: true };
  }
}
