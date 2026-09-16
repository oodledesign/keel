import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  type SurveySystemTemplateKey,
  type SurveyTemplateDefinition,
  type SurveyTemplateRecord,
  cloneSystemSurveyTemplate,
  isSurveySystemTemplateKey,
  systemSurveyTemplate,
} from '~/lib/building-surveyor/survey-template';
import type { Database } from '~/lib/database.types';

import type {
  CloneSurveyTemplateInput,
  DeleteSurveyTemplateInput,
  UpdateSurveyTemplateInput,
} from '../schema/survey-templates.schema';

function mapTemplate(row: Record<string, unknown>): SurveyTemplateRecord {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    systemKey: row.system_key as SurveySystemTemplateKey,
    surveyType: row.survey_type as SurveySystemTemplateKey,
    name: row.name as string,
    isDefault: Boolean(row.is_default),
    brand: (row.brand as SurveyTemplateRecord['brand']) ?? {
      primaryColor: '#4A2C6A',
      footerLabel: 'RICS Home Survey',
    },
    surveyorDefaults: (row.surveyor_defaults as Record<string, string>) ?? {},
    blocks: (row.blocks as SurveyTemplateRecord['blocks']) ?? [],
    sourceSystemKey:
      (row.source_system_key as SurveySystemTemplateKey | null) ??
      (row.system_key as SurveySystemTemplateKey),
    updatedAt: row.updated_at as string,
  };
}

export function createSurveyTemplatesService(client: SupabaseClient<Database>) {
  return new SurveyTemplatesService(client);
}

class SurveyTemplatesService {
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

  async list(accountId: string): Promise<SurveyTemplateRecord[]> {
    await this.ensureAccess(accountId, 'invoices.view');
    const { data, error } = await this.db
      .from('survey_templates')
      .select(
        'id, account_id, system_key, survey_type, name, is_default, brand, surveyor_defaults, blocks, source_system_key, updated_at',
      )
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false });
    if (error) this.throwErr(error);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapTemplate);
  }

  async clone(input: CloneSurveyTemplateInput): Promise<SurveyTemplateRecord> {
    const user = await this.ensureEditor(input.accountId);
    const definition = cloneSystemSurveyTemplate(input.systemKey, input.name);

    if (input.setDefault) {
      await this.db
        .from('survey_templates')
        .update({ is_default: false })
        .eq('account_id', input.accountId)
        .eq('survey_type', definition.surveyType);
    }

    const { data, error } = await this.db
      .from('survey_templates')
      .insert({
        account_id: input.accountId,
        system_key: definition.key,
        survey_type: definition.surveyType,
        name: definition.name,
        is_default: Boolean(input.setDefault),
        brand: definition.brand,
        surveyor_defaults: definition.surveyorDefaults,
        blocks: definition.blocks,
        source_system_key: definition.key,
        created_by: user.id,
      })
      .select(
        'id, account_id, system_key, survey_type, name, is_default, brand, surveyor_defaults, blocks, source_system_key, updated_at',
      )
      .single();
    if (error || !data) this.throwErr(error, 'Could not clone template');
    return mapTemplate(data as Record<string, unknown>);
  }

  async update(
    input: UpdateSurveyTemplateInput,
  ): Promise<SurveyTemplateRecord> {
    await this.ensureEditor(input.accountId);
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.brand !== undefined) payload.brand = input.brand;
    if (input.surveyorDefaults !== undefined) {
      payload.surveyor_defaults = input.surveyorDefaults;
    }
    if (input.blocks !== undefined) payload.blocks = input.blocks;
    if (input.isDefault !== undefined) {
      payload.is_default = input.isDefault;
      if (input.isDefault) {
        const { data: current } = await this.db
          .from('survey_templates')
          .select('survey_type')
          .eq('id', input.templateId)
          .eq('account_id', input.accountId)
          .maybeSingle();
        if (current?.survey_type) {
          await this.db
            .from('survey_templates')
            .update({ is_default: false })
            .eq('account_id', input.accountId)
            .eq('survey_type', current.survey_type)
            .neq('id', input.templateId);
        }
      }
    }

    const { data, error } = await this.db
      .from('survey_templates')
      .update(payload)
      .eq('id', input.templateId)
      .eq('account_id', input.accountId)
      .select(
        'id, account_id, system_key, survey_type, name, is_default, brand, surveyor_defaults, blocks, source_system_key, updated_at',
      )
      .single();
    if (error || !data) this.throwErr(error, 'Could not update template');
    return mapTemplate(data as Record<string, unknown>);
  }

  async remove(input: DeleteSurveyTemplateInput) {
    await this.ensureEditor(input.accountId);
    const { error } = await this.db
      .from('survey_templates')
      .delete()
      .eq('id', input.templateId)
      .eq('account_id', input.accountId);
    if (error) this.throwErr(error);
    return { ok: true };
  }

  async resolveForSurvey(input: {
    accountId: string;
    surveyType?: string | null;
    templateId?: string | null;
  }): Promise<SurveyTemplateDefinition> {
    if (input.templateId) {
      const { data } = await this.db
        .from('survey_templates')
        .select(
          'system_key, survey_type, name, brand, surveyor_defaults, blocks, source_system_key',
        )
        .eq('id', input.templateId)
        .eq('account_id', input.accountId)
        .maybeSingle();
      if (data) {
        const key = isSurveySystemTemplateKey(data.system_key)
          ? data.system_key
          : 'rics_hss_l3';
        return {
          key,
          name: data.name as string,
          surveyType: isSurveySystemTemplateKey(data.survey_type)
            ? data.survey_type
            : key,
          brand: (data.brand ??
            systemSurveyTemplate(key)
              .brand) as SurveyTemplateDefinition['brand'],
          surveyorDefaults:
            (data.surveyor_defaults as Record<string, string>) ?? {},
          blocks: (data.blocks ??
            systemSurveyTemplate(key)
              .blocks) as SurveyTemplateDefinition['blocks'],
        };
      }
    }

    const surveyType = isSurveySystemTemplateKey(input.surveyType)
      ? input.surveyType
      : 'rics_hss_l3';

    const { data: fallback } = await this.db
      .from('survey_templates')
      .select(
        'system_key, survey_type, name, brand, surveyor_defaults, blocks, source_system_key, is_default',
      )
      .eq('account_id', input.accountId)
      .eq('survey_type', surveyType)
      .eq('is_default', true)
      .maybeSingle();

    if (fallback) {
      return {
        key: surveyType,
        name: fallback.name as string,
        surveyType,
        brand: (fallback.brand ??
          systemSurveyTemplate(surveyType)
            .brand) as SurveyTemplateDefinition['brand'],
        surveyorDefaults:
          (fallback.surveyor_defaults as Record<string, string>) ?? {},
        blocks: (fallback.blocks ??
          systemSurveyTemplate(surveyType)
            .blocks) as SurveyTemplateDefinition['blocks'],
      };
    }

    return systemSurveyTemplate(surveyType);
  }
}
