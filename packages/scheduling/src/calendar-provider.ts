import type { BusyInterval } from './types';

/**
 * Calendar provider abstraction.
 *
 * Google is implemented today. Outlook / Microsoft 365 should implement this
 * interface later without changing slot computation or booking orchestration.
 *
 * @extension Outlook — add `OutlookCalendarProvider` implementing this interface
 * and register it beside Google in the provider registry. Do not fork
 * `computeAvailableSlots`.
 */
export interface CalendarProvider {
  readonly id: 'google' | 'outlook';

  getBusyIntervals(
    workspaceId: string,
    from: Date,
    to: Date,
  ): Promise<BusyInterval[]>;
}

export type CalendarProviderId = CalendarProvider['id'];
