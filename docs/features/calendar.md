# Calendar feature

The Keel calendar shows job events (visits/meetings) and job deadlines in a unified month, week, or agenda view. It is used on the **Job Detail → Schedule** tab and is designed to be reused for an org-level calendar later.

## Unified event shape

All calendar items are normalized to this shape (see `apps/web/app/home/[account]/jobs/_lib/schema/calendar.schema.ts`):

```ts
type CalendarItem = {
  id: string;
  source_type: 'job_event' | 'job_deadline';
  source_id: string;           // event id or job id
  title: string;
  start_at: string;            // ISO
  end_at?: string;             // ISO, optional
  all_day: boolean;
  job_id?: string;
  client_id?: string;
  status?: string;
  priority?: string;
  event_type?: 'site_visit' | 'meeting';  // job_event only
  location?: string | null;                // job_event only
};
```

- **job_event**: from `job_events` (scheduled_start_at / scheduled_end_at). Shown as timed or all-day.
- **job_deadline**: from `jobs` (due_date or start_date). Shown as all-day; `source_id` is the job id.

## Server actions

- **getJobCalendarItems({ accountId, jobId, start, end })**  
  Returns items for a single job: its events plus that job’s due/start date if in range. Used on the Job Schedule tab.

- **getOrgCalendarItems({ accountId, start, end })**  
  Returns items for the whole org: all job_events in range and all jobs whose due_date or start_date falls in range. For future org-level calendar.

- **getCalendarItemDetails({ accountId, source_type, source_id })**  
  Returns the full record for the details panel (job_event row or job row). Used when the user clicks an event.

All use the authenticated Supabase client; RLS applies. No service role.

## Data flow and performance

- The calendar fetches only the **visible date range**. FullCalendar’s `datesSet` (or the wrapper’s `onDatesSet`) is used to pass `start`/`end` to the server; the client refetches when the user changes month/week.
- Full details are loaded only when the user **clicks an event**, via `getCalendarItemDetails`.

## Adding new sources

To add another type (e.g. invoice due dates, agreement sent):

1. **Schema**  
   - Extend `source_type` in `calendar.schema.ts` (e.g. `'invoice_due'`).  
   - Add any extra fields to `CalendarItem` if needed.

2. **Service**  
   - In `calendar.service.ts`, in `getJobCalendarItems` and/or `getOrgCalendarItems`, query the new table and map rows into `CalendarItem` with the new `source_type` and `source_id`.

3. **Details**  
   - In `getCalendarItemDetails`, add a branch for the new `source_type` and return the full record for the details panel.

4. **UI**  
   - In the details panel (e.g. `job-schedule-tab.tsx`), handle the new type (badge, fields, link).

## Drag-and-drop (future)

- FullCalendar is currently **non-editable** (`editable: false`, `selectable: false`).
- To enable drag-and-drop or resize:
  - Set `editable: true` (and optionally `selectable: true`).
  - Subscribe to `eventDrop` / `eventResize` and call a server action to update `job_events.scheduled_start_at` / `scheduled_end_at` (and enforce permissions).
  - Job deadlines (all-day) could be made draggable to change `jobs.due_date` or `jobs.start_date` via a separate action.

## Files

| Area | Path |
|------|------|
| Reusable calendar component | `apps/web/components/calendar/KeelCalendar.tsx` |
| Calendar schema | `apps/web/app/home/[account]/jobs/_lib/schema/calendar.schema.ts` |
| Calendar service | `apps/web/app/home/[account]/jobs/_lib/server/calendar.service.ts` |
| Server actions | `apps/web/app/home/[account]/jobs/_lib/server/server-actions.ts` (getJobCalendarItems, getOrgCalendarItems, getCalendarItemDetails) |
| Job Schedule tab | `apps/web/app/home/[account]/jobs/_components/job-schedule-tab.tsx` |
| Schedule tab integration | `apps/web/app/home/[account]/jobs/_components/job-detail-content.tsx` |

## Views

- **Month**: `dayGridMonth`
- **Week**: `timeGridWeek`
- **Agenda**: `listWeek`

Toggle is in the Schedule tab; styling follows the app’s dark theme (zinc, no default FullCalendar blue).
