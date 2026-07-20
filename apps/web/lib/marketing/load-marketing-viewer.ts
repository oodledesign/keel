import 'server-only';

import { cache } from 'react';

import pathsConfig from '~/config/paths.config';
import { getOptionalUserInServerComponent } from '~/lib/server/get-optional-user-in-server-component';

import {
  type MarketingViewerContext,
  formatMarketingDateLabel,
  getTimeOfDayGreeting,
  resolveMarketingViewerFirstName,
} from './marketing-viewer';

export const loadMarketingViewer = cache(
  async (): Promise<MarketingViewerContext> => {
    const now = new Date();
    const greeting = getTimeOfDayGreeting(now);
    const dateLabel = formatMarketingDateLabel(now);
    const dashboardHref = pathsConfig.app.home;

    const user = await getOptionalUserInServerComponent();

    if (!user || user.is_anonymous) {
      return {
        isAuthenticated: false,
        firstName: null,
        dashboardHref,
        greeting,
        dateLabel,
      };
    }

    return {
      isAuthenticated: true,
      firstName: resolveMarketingViewerFirstName(user),
      dashboardHref,
      greeting,
      dateLabel,
    };
  },
);
