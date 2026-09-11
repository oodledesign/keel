import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import {
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  parseCampaignAudienceConfig,
  parseCampaignAudienceType,
} from '~/lib/campaigns/campaign-audience';
import {
  parseCampaignDocument,
  resolveCampaignDocument,
} from '~/lib/campaigns/campaign-document';
import {
  type SeriesRecurrenceFreq,
  seriesRecurrenceSummary as describeSeriesRecurrence,
  formatInstanceCampaignName,
  formatOccurrenceLabel,
  planSeriesInstanceGeneration,
} from '~/lib/campaigns/campaign-recurrence';
import { parseCampaignTimezone } from '~/lib/campaigns/campaign-timezone';
import type {
  EmailCampaign,
  EmailCampaignSeries,
  EmailCampaignSeriesStatus,
} from '~/lib/campaigns/campaign.types';
import { compileCampaignDocument } from '~/lib/campaigns/compile-campaign-document';

const SERIES_TABLE = 'workspace_email_campaign_series';
const CAMPAIGNS_TABLE = 'workspace_email_campaigns';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function mapSeries(row: Record<string, unknown>): EmailCampaignSeries {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    createdBy: (row.created_by as string | null) ?? null,
    name: String(row.name),
    timezone: parseCampaignTimezone(row.timezone),
    recurrenceFreq: row.recurrence_freq === 'monthly' ? 'monthly' : 'weekly',
    recurrenceInterval: Math.max(1, Number(row.recurrence_interval ?? 1)),
    recurrenceByWeekday:
      row.recurrence_by_weekday == null
        ? null
        : Number(row.recurrence_by_weekday),
    recurrenceByMonthday:
      row.recurrence_by_monthday == null
        ? null
        : Number(row.recurrence_by_monthday),
    sendHour: Number(row.send_hour ?? 12),
    sendMinute: Number(row.send_minute ?? 0),
    startsOn: String(row.starts_on).slice(0, 10),
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    generateAhead: Math.max(1, Number(row.generate_ahead ?? 4)),
    audienceType: parseCampaignAudienceType(row.audience_type),
    audienceConfig: parseCampaignAudienceConfig(row.audience_config),
    subject: String(row.subject ?? ''),
    previewText: (row.preview_text as string | null) ?? null,
    bodyDocument: parseCampaignDocument(row.body_document),
    htmlBody: String(row.html_body ?? ''),
    fromName: (row.from_name as string | null) ?? null,
    fromEmail: (row.from_email as string | null) ?? null,
    replyTo: (row.reply_to as string | null) ?? null,
    status: (row.status as EmailCampaignSeriesStatus) ?? 'active',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function seriesRecurrenceSummary(series: EmailCampaignSeries): string {
  return describeSeriesRecurrence(series);
}

export function createCampaignSeriesService(client: SupabaseClient) {
  return new CampaignSeriesService(client);
}

class CampaignSeriesService {
  constructor(private readonly client: SupabaseClient) {}

  async list(accountId: string): Promise<EmailCampaignSeries[]> {
    const { data, error } = await fromTable(this.client, SERIES_TABLE)
      .select('*')
      .eq('account_id', accountId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapSeries);
  }

  async get(accountId: string, seriesId: string): Promise<EmailCampaignSeries> {
    const { data, error } = await fromTable(this.client, SERIES_TABLE)
      .select('*')
      .eq('account_id', accountId)
      .eq('id', seriesId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Series not found');
    return mapSeries(data as Record<string, unknown>);
  }

  async listInstances(
    accountId: string,
    seriesId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      subject: string;
      status: EmailCampaign['status'];
      scheduledAt: string | null;
      scheduledTimezone: string;
      ready: boolean;
      occurrenceKey: string | null;
      sentCount: number;
      sentAt: string | null;
    }>
  > {
    const { data, error } = await fromTable(this.client, CAMPAIGNS_TABLE)
      .select(
        'id, name, subject, status, scheduled_at, scheduled_timezone, ready, occurrence_key, sent_count, sent_at',
      )
      .eq('account_id', accountId)
      .eq('series_id', seriesId)
      .order('scheduled_at', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      subject: String(row.subject ?? ''),
      status: row.status as EmailCampaign['status'],
      scheduledAt: (row.scheduled_at as string | null) ?? null,
      scheduledTimezone: parseCampaignTimezone(row.scheduled_timezone),
      ready: row.ready !== false,
      occurrenceKey: (row.occurrence_key as string | null) ?? null,
      sentCount: Number(row.sent_count ?? 0),
      sentAt: (row.sent_at as string | null) ?? null,
    }));
  }

  async create(input: {
    accountId: string;
    userId: string;
    name: string;
    timezone?: string;
    recurrenceFreq?: SeriesRecurrenceFreq;
    recurrenceInterval?: number;
    recurrenceByWeekday?: number | null;
    recurrenceByMonthday?: number | null;
    sendHour: number;
    sendMinute?: number;
    startsOn: string;
    endsOn?: string | null;
    generateAhead?: number;
    audienceType?: CampaignAudienceType;
    audienceConfig?: CampaignAudienceConfig;
    subject?: string;
    previewText?: string | null;
    bodyDocument?: unknown;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
  }): Promise<EmailCampaignSeries> {
    const brand = await loadAccountBrandResolved(input.accountId);
    const document = resolveCampaignDocument(input.bodyDocument, '', brand);
    const htmlBody = compileCampaignDocument(document, brand);
    const freq = input.recurrenceFreq ?? 'weekly';

    const { data, error } = await fromTable(this.client, SERIES_TABLE)
      .insert({
        account_id: input.accountId,
        created_by: input.userId,
        name: input.name.trim(),
        timezone: parseCampaignTimezone(input.timezone),
        recurrence_freq: freq,
        recurrence_interval: input.recurrenceInterval ?? 1,
        recurrence_by_weekday:
          freq === 'weekly' ? (input.recurrenceByWeekday ?? 5) : null,
        recurrence_by_monthday:
          freq === 'monthly' ? (input.recurrenceByMonthday ?? 1) : null,
        send_hour: input.sendHour,
        send_minute: input.sendMinute ?? 0,
        starts_on: input.startsOn,
        ends_on: input.endsOn || null,
        generate_ahead: input.generateAhead ?? 4,
        audience_type: parseCampaignAudienceType(input.audienceType),
        audience_config: parseCampaignAudienceConfig(input.audienceConfig),
        subject: input.subject?.trim() ?? '',
        preview_text: input.previewText?.trim() || null,
        body_document: document,
        html_body: htmlBody,
        from_name: input.fromName?.trim() || null,
        from_email: input.fromEmail?.trim() || null,
        reply_to: input.replyTo?.trim() || null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create series');
    }

    const series = mapSeries(data as Record<string, unknown>);
    try {
      await this.generateMissing(series);
    } catch (error) {
      console.error(
        '[campaigns] generate series instances after create failed',
        series.id,
        error instanceof Error ? error.message : error,
      );
    }
    return series;
  }

  async update(input: {
    accountId: string;
    seriesId: string;
    name?: string;
    timezone?: string;
    recurrenceByWeekday?: number | null;
    sendHour?: number;
    sendMinute?: number;
    startsOn?: string;
    endsOn?: string | null;
    generateAhead?: number;
    audienceType?: CampaignAudienceType;
    audienceConfig?: CampaignAudienceConfig;
    subject?: string;
    previewText?: string | null;
    bodyDocument?: unknown;
    fromName?: string | null;
    fromEmail?: string | null;
    replyTo?: string | null;
    status?: EmailCampaignSeriesStatus;
  }): Promise<EmailCampaignSeries> {
    const existing = await this.get(input.accountId, input.seriesId);
    const patch: Record<string, unknown> = {};

    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.timezone !== undefined) {
      patch.timezone = parseCampaignTimezone(input.timezone);
    }
    if (input.recurrenceByWeekday !== undefined) {
      patch.recurrence_by_weekday = input.recurrenceByWeekday;
    }
    if (input.sendHour !== undefined) patch.send_hour = input.sendHour;
    if (input.sendMinute !== undefined) patch.send_minute = input.sendMinute;
    if (input.startsOn !== undefined) patch.starts_on = input.startsOn;
    if (input.endsOn !== undefined) patch.ends_on = input.endsOn || null;
    if (input.generateAhead !== undefined) {
      patch.generate_ahead = input.generateAhead;
    }
    if (input.audienceType !== undefined) {
      patch.audience_type = parseCampaignAudienceType(input.audienceType);
    }
    if (input.audienceConfig !== undefined) {
      patch.audience_config = parseCampaignAudienceConfig(input.audienceConfig);
    }
    if (input.subject !== undefined) patch.subject = input.subject.trim();
    if (input.previewText !== undefined) {
      patch.preview_text = input.previewText?.trim() || null;
    }
    if (input.fromName !== undefined) {
      patch.from_name = input.fromName?.trim() || null;
    }
    if (input.fromEmail !== undefined) {
      patch.from_email = input.fromEmail?.trim() || null;
    }
    if (input.replyTo !== undefined) {
      patch.reply_to = input.replyTo?.trim() || null;
    }
    if (input.status !== undefined) patch.status = input.status;

    if (input.bodyDocument !== undefined) {
      const brand = await loadAccountBrandResolved(input.accountId);
      const document = resolveCampaignDocument(
        input.bodyDocument,
        existing.htmlBody,
        brand,
      );
      patch.body_document = document;
      patch.html_body = compileCampaignDocument(document, brand);
    }

    const { data, error } = await fromTable(this.client, SERIES_TABLE)
      .update(patch)
      .eq('id', input.seriesId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not update series');
    }

    const series = mapSeries(data as Record<string, unknown>);
    if (series.status === 'active') {
      await this.generateMissing(series);
    }
    return series;
  }

  async generateMissing(series: EmailCampaignSeries): Promise<number> {
    if (series.status !== 'active') return 0;

    const { data, error } = await fromTable(this.client, CAMPAIGNS_TABLE)
      .select('occurrence_key, scheduled_at, status')
      .eq('account_id', series.accountId)
      .eq('series_id', series.id);

    if (error) throw new Error(error.message);

    const planned = planSeriesInstanceGeneration({
      freq: series.recurrenceFreq,
      interval: series.recurrenceInterval,
      weekday: series.recurrenceByWeekday,
      monthday: series.recurrenceByMonthday,
      hour: series.sendHour,
      minute: series.sendMinute,
      timezone: series.timezone,
      startsOn: series.startsOn,
      endsOn: series.endsOn,
      generateAhead: series.generateAhead,
      existing: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        occurrenceKey: String(row.occurrence_key ?? ''),
        scheduledAt: (row.scheduled_at as string | null) ?? null,
        status: String(row.status ?? 'draft'),
      })),
    });

    if (planned.length === 0) return 0;

    const document = resolveCampaignDocument(
      series.bodyDocument,
      series.htmlBody,
    );
    const rows = planned.map((occurrence) => ({
      account_id: series.accountId,
      created_by: series.createdBy,
      name: formatInstanceCampaignName(
        series.name,
        formatOccurrenceLabel(occurrence.occurrenceKey, series.timezone),
      ),
      subject: series.subject,
      preview_text: series.previewText,
      html_body: series.htmlBody,
      body_document: document,
      from_name: series.fromName,
      from_email: series.fromEmail,
      reply_to: series.replyTo,
      audience_type: series.audienceType,
      audience_config: series.audienceConfig,
      status: 'draft',
      scheduled_at: occurrence.scheduledAt,
      scheduled_timezone: series.timezone,
      series_id: series.id,
      occurrence_key: occurrence.occurrenceKey,
      ready: false,
    }));

    const { error: insertError } = await fromTable(
      this.client,
      CAMPAIGNS_TABLE,
    ).insert(rows);

    if (insertError) {
      if (insertError.code === '23505') {
        return 0;
      }
      throw new Error(insertError.message);
    }

    return rows.length;
  }

  async markInstanceReady(input: {
    accountId: string;
    campaignId: string;
  }): Promise<void> {
    const campaign = await this.requireInstance(
      input.accountId,
      input.campaignId,
    );
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('Only draft occurrences can be marked ready');
    }
    if (!campaign.scheduledAt) {
      throw new Error('This occurrence has no send time');
    }

    // Past occurrence times stay scheduled so the next cron tick can catch up.
    const { error } = await fromTable(this.client, CAMPAIGNS_TABLE)
      .update({
        ready: true,
        status: 'scheduled',
        scheduled_at: campaign.scheduledAt,
      })
      .eq('id', campaign.id)
      .eq('account_id', input.accountId)
      .in('status', ['draft', 'scheduled']);

    if (error) throw new Error(error.message);
  }

  async markInstanceUnready(input: {
    accountId: string;
    campaignId: string;
  }): Promise<void> {
    const campaign = await this.requireInstance(
      input.accountId,
      input.campaignId,
    );
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('This occurrence can no longer be unreadied');
    }

    const { error } = await fromTable(this.client, CAMPAIGNS_TABLE)
      .update({
        ready: false,
        status: 'draft',
      })
      .eq('id', campaign.id)
      .eq('account_id', input.accountId)
      .in('status', ['draft', 'scheduled']);

    if (error) throw new Error(error.message);
  }

  async skipInstance(input: {
    accountId: string;
    campaignId: string;
  }): Promise<void> {
    const campaign = await this.requireInstance(
      input.accountId,
      input.campaignId,
    );
    if (
      campaign.status === 'sending' ||
      campaign.status === 'sent' ||
      campaign.status === 'cancelled'
    ) {
      throw new Error('This occurrence cannot be skipped');
    }

    const { error } = await fromTable(this.client, CAMPAIGNS_TABLE)
      .update({
        status: 'cancelled',
        ready: false,
      })
      .eq('id', campaign.id)
      .eq('account_id', input.accountId);

    if (error) throw new Error(error.message);

    if (campaign.seriesId) {
      const series = await this.get(input.accountId, campaign.seriesId);
      await this.generateMissing(series);
    }
  }

  private async requireInstance(accountId: string, campaignId: string) {
    const { data, error } = await fromTable(this.client, CAMPAIGNS_TABLE)
      .select('id, series_id, status, scheduled_at, ready, occurrence_key')
      .eq('account_id', accountId)
      .eq('id', campaignId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Campaign not found');
    const row = data as Record<string, unknown>;
    if (!row.series_id) {
      throw new Error('This campaign is not a recurring occurrence');
    }
    return {
      id: String(row.id),
      seriesId: String(row.series_id),
      status: String(row.status),
      scheduledAt: (row.scheduled_at as string | null) ?? null,
      ready: row.ready !== false,
      occurrenceKey: (row.occurrence_key as string | null) ?? null,
    };
  }
}

export async function generateMissingSeriesInstances(
  client: SupabaseClient,
  options?: { limit?: number },
): Promise<number> {
  const { data, error } = await fromTable(client, SERIES_TABLE)
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: true })
    .limit(Math.max(1, Math.min(options?.limit ?? 40, 80)));

  if (error) throw new Error(error.message);

  const service = createCampaignSeriesService(client);
  let generated = 0;

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    try {
      generated += await service.generateMissing(mapSeries(row));
    } catch (err) {
      console.error(
        '[campaigns] generate series instances failed',
        row.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return generated;
}
