import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { parseGoreportXlsx } from '~/lib/building-surveyor/goreport-import';
import type { Database } from '~/lib/database.types';

import type {
  DeleteSurveyPhraseBankInput,
  ImportGoreportPhrasesInput,
  ListSurveyPhrasesInput,
  SurveyPhrase,
  SurveyPhraseBank,
} from '../schema/survey-phrases.schema';

function mapPhrase(row: Record<string, unknown>): SurveyPhrase {
  return {
    id: row.id as string,
    bankId: row.bank_id as string,
    title: row.title as string,
    body: row.body as string,
    ricsCode: (row.rics_code as string | null) ?? null,
    sectionKey: (row.section_key as string | null) ?? null,
    defaultRating: (row.default_rating as string | null) ?? null,
    goreportPath: (row.goreport_path as string | null) ?? null,
  };
}

export function createSurveyPhrasesService(client: SupabaseClient<Database>) {
  return new SurveyPhrasesService(client);
}

class SurveyPhrasesService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const message =
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(message);
  }

  async ensureAccess(
    accountId: string,
    permission: 'invoices.view' | 'invoices.edit' = 'invoices.edit',
  ) {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (!hasPermission) throw new Error('Permission denied');

    const { data, error } = await this.db
      .from('accounts')
      .select('id, space_type')
      .eq('id', accountId)
      .maybeSingle();
    if (error) this.throwErr(error);
    if (
      (data as { space_type?: string } | null)?.space_type !==
      'building-surveyor'
    ) {
      throw new Error(
        'This action is only available in a building-surveyor workspace',
      );
    }
    return user;
  }

  async ensureEditor(accountId: string) {
    return this.ensureAccess(accountId, 'invoices.edit');
  }

  async listBanks(accountId: string): Promise<SurveyPhraseBank[]> {
    await this.ensureAccess(accountId, 'invoices.view');
    const { data, error } = await this.db
      .from('survey_phrase_banks')
      .select('id, name, scope, source, survey_type, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) this.throwErr(error);

    const banks = (data ?? []) as Array<Record<string, unknown>>;
    const counts = await Promise.all(
      banks.map(async (bank) => {
        const { count } = await this.db
          .from('survey_phrases')
          .select('id', { count: 'exact', head: true })
          .eq('bank_id', bank.id);
        return Number(count ?? 0);
      }),
    );

    return banks.map((bank, index) => ({
      id: bank.id as string,
      name: bank.name as string,
      scope: bank.scope as 'personal' | 'workspace',
      source: (bank.source as string | null) ?? null,
      surveyType: (bank.survey_type as string | null) ?? null,
      phraseCount: counts[index] ?? 0,
      createdAt: bank.created_at as string,
    }));
  }

  async listPhrases(input: ListSurveyPhrasesInput): Promise<SurveyPhrase[]> {
    await this.ensureAccess(input.accountId, 'invoices.view');
    let query = this.db
      .from('survey_phrases')
      .select(
        'id, bank_id, title, body, rics_code, section_key, default_rating, goreport_path',
      )
      .eq('account_id', input.accountId)
      .order('sort_order', { ascending: true })
      .limit(80);

    if (input.ricsCode) {
      query = query.eq('rics_code', input.ricsCode);
    } else if (input.sectionKey) {
      query = query.eq('section_key', input.sectionKey);
    }
    if (input.query?.trim()) {
      const likePattern = `%${input.query.trim().replace(/[%_\\]/g, '\\$&')}%`;
      const quotedLike = `"${likePattern.replace(/"/g, '')}"`;
      query = query.or(`title.ilike.${quotedLike},body.ilike.${quotedLike}`);
    }

    const { data, error } = await query;
    if (error) this.throwErr(error);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapPhrase);
  }

  async importGoreport(input: ImportGoreportPhrasesInput) {
    const user = await this.ensureEditor(input.accountId);
    const buffer = Buffer.from(input.fileBase64, 'base64');
    if (buffer.length < 32) {
      throw new Error('That file is too small to be a GoReport export');
    }

    const parsed = parseGoreportXlsx(buffer);
    if (parsed.phrases.length === 0) {
      throw new Error(
        'No predefined responses found. Use a GoReport Predefined Responses xlsx.',
      );
    }

    const { data: bank, error: bankError } = await this.db
      .from('survey_phrase_banks')
      .insert({
        account_id: input.accountId,
        user_id: user.id,
        scope: input.scope,
        name: input.name.trim(),
        source: 'goreport_import',
        survey_type: input.surveyType ?? null,
        created_by: user.id,
      })
      .select('id, name, scope, source, survey_type, created_at')
      .single();
    if (bankError || !bank)
      this.throwErr(bankError, 'Could not create phrase bank');

    const rows = parsed.phrases.map((phrase, index) => ({
      bank_id: bank.id,
      account_id: input.accountId,
      title: phrase.title.slice(0, 300),
      body: phrase.body.slice(0, 20_000),
      rics_code: phrase.ricsCode,
      section_key: phrase.sectionKey,
      goreport_path: phrase.goreportPath.slice(0, 500),
      sort_order: index,
    }));

    const chunkSize = 200;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const { error } = await this.db
        .from('survey_phrases')
        .insert(rows.slice(offset, offset + chunkSize));
      if (error) this.throwErr(error, 'Could not import phrases');
    }

    return {
      bank: {
        id: bank.id as string,
        name: bank.name as string,
        scope: bank.scope as 'personal' | 'workspace',
        source: (bank.source as string | null) ?? 'goreport_import',
        surveyType: (bank.survey_type as string | null) ?? null,
        phraseCount: parsed.phrases.length,
        createdAt: bank.created_at as string,
      } satisfies SurveyPhraseBank,
      imported: parsed.phrases.length,
      fieldCount: parsed.fieldCount,
    };
  }

  async removeBank(input: DeleteSurveyPhraseBankInput) {
    await this.ensureEditor(input.accountId);
    const { error } = await this.db
      .from('survey_phrase_banks')
      .delete()
      .eq('id', input.bankId)
      .eq('account_id', input.accountId);
    if (error) this.throwErr(error);
    return { ok: true };
  }
}
