import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  COMMERCIAL_PIPELINE_STAGES,
  type CommercialPipelineStage,
} from '~/lib/commercial/commercial-constants';

export type CommercialReportsMetrics = {
  stockOnMarket: number;
  underOffer: number;
  unactionedEnquiries: number;
  upcomingViewings: number;
  avgDaysOnMarket: number | null;
  pipelineByStage: Record<CommercialPipelineStage, number>;
};

function emptyPipelineCounts(): Record<CommercialPipelineStage, number> {
  return COMMERCIAL_PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = 0;
      return acc;
    },
    {} as Record<CommercialPipelineStage, number>,
  );
}

export function createCommercialReportsService(client: SupabaseClient) {
  return {
    async getMetrics(accountId: string): Promise<CommercialReportsMetrics> {
      const now = new Date().toISOString();

      const [
        marketingResult,
        underOfferResult,
        enquiriesResult,
        viewingsResult,
        marketingListingsResult,
        pipelineResult,
      ] = await Promise.all([
        client
          .from('commercial_listings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'marketing'),
        client
          .from('commercial_listings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'under_offer'),
        client
          .from('commercial_enquiries')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'unactioned'),
        client
          .from('commercial_viewings')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .eq('status', 'upcoming'),
        client
          .from('commercial_listings')
          .select('on_market_at')
          .eq('account_id', accountId)
          .eq('status', 'marketing')
          .not('on_market_at', 'is', null),
        client
          .from('pipeline_deals')
          .select('stage')
          .eq('account_id', accountId)
          .in('stage', [...COMMERCIAL_PIPELINE_STAGES]),
      ]);

      if (marketingResult.error) {
        console.error(
          '[commercial-reports] marketing count:',
          marketingResult.error.message,
        );
      }
      if (underOfferResult.error) {
        console.error(
          '[commercial-reports] under offer count:',
          underOfferResult.error.message,
        );
      }
      if (enquiriesResult.error) {
        console.error(
          '[commercial-reports] enquiries count:',
          enquiriesResult.error.message,
        );
      }
      if (viewingsResult.error) {
        console.error(
          '[commercial-reports] viewings count:',
          viewingsResult.error.message,
        );
      }
      if (marketingListingsResult.error) {
        console.error(
          '[commercial-reports] days on market:',
          marketingListingsResult.error.message,
        );
      }
      if (pipelineResult.error) {
        console.error(
          '[commercial-reports] pipeline:',
          pipelineResult.error.message,
        );
      }

      const onMarketRows = marketingListingsResult.data ?? [];
      let avgDaysOnMarket: number | null = null;

      if (onMarketRows.length > 0) {
        const nowMs = new Date(now).getTime();
        const totalDays = onMarketRows.reduce((sum, row) => {
          const onMarketAt = row.on_market_at as string;
          const days =
            (nowMs - new Date(onMarketAt).getTime()) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0);
        avgDaysOnMarket = Math.round(totalDays / onMarketRows.length);
      }

      const pipelineByStage = emptyPipelineCounts();
      for (const row of pipelineResult.data ?? []) {
        const stage = row.stage as CommercialPipelineStage;
        if (stage in pipelineByStage) {
          pipelineByStage[stage] += 1;
        }
      }

      return {
        stockOnMarket: marketingResult.count ?? 0,
        underOffer: underOfferResult.count ?? 0,
        unactionedEnquiries: enquiriesResult.count ?? 0,
        upcomingViewings: viewingsResult.count ?? 0,
        avgDaysOnMarket,
        pipelineByStage,
      };
    },
  };
}
