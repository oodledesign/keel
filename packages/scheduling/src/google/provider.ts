import 'server-only';

import type { CalendarProvider } from '../calendar-provider';
import { getBusyIntervals } from './busy';

/**
 * Google Calendar provider. Outlook should implement `CalendarProvider`
 * separately — see the extension note on that interface.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = 'google' as const;

  constructor(private readonly hostUserId?: string) {}

  getBusyIntervals(workspaceId: string, from: Date, to: Date) {
    return getBusyIntervals(workspaceId, from, to, {
      hostUserId: this.hostUserId,
    });
  }
}
