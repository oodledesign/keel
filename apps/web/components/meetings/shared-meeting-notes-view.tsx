import { Users } from 'lucide-react';

import { PublicMeetingNotesTabs } from '~/components/meetings/public-meeting-notes-tabs';
import {
  type PublicMeetingParty,
  type PublicMeetingPayload,
} from '~/lib/recorder/public-meeting.loader';

function formatMeetingDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function PartyRow({
  party,
  label,
}: {
  party: PublicMeetingParty;
  label: string;
}) {
  const initial = party.name.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--ozer-border-on-light)] bg-white">
        {party.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={party.logoUrl}
            alt=""
            className="h-full w-full object-contain p-0.5"
          />
        ) : (
          <span className="text-[11px] font-semibold text-[var(--ozer-text-on-light)]">
            {initial}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
          {party.name}
        </p>
      </div>
    </div>
  );
}

type Props = {
  meeting: PublicMeetingPayload;
  /** When true, omit the full-bleed public page chrome (portal embeds this). */
  embedded?: boolean;
  footerNote?: string | null;
};

export function SharedMeetingNotesView({
  meeting,
  embedded = false,
  footerNote,
}: Props) {
  const dateLabel = formatMeetingDate(meeting.meetingDate);
  const panelClass =
    'rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white/80 p-5 shadow-sm';
  const openTaskCount = meeting.tasks.filter((task) => !task.completed).length;
  const participantNames = Array.from(
    new Set(
      meeting.speakerSegments
        .map((segment) => segment.speaker.trim())
        .filter((name) => name.length > 0 && !/^speaker\s*\d+$/i.test(name)),
    ),
  );

  const body = (
    <>
      <header className="space-y-2">
        <p className="text-xs tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
          Meeting notes
        </p>
        <h1
          className={
            embedded
              ? 'font-heading text-2xl font-semibold tracking-tight text-[var(--ozer-text-on-light)] md:text-3xl'
              : 'font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-text-on-light)] md:text-4xl'
          }
        >
          {meeting.title}
        </h1>
        {dateLabel ? (
          <p className="text-sm font-medium text-[var(--ozer-plum-700)]">
            {dateLabel}
          </p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)] lg:items-start">
        <PublicMeetingNotesTabs
          summaryText={meeting.summaryText}
          content={meeting.content}
          speakerSegments={meeting.speakerSegments}
          panelClassName={panelClass}
          showTasks={meeting.showTasks}
          tasks={meeting.tasks}
        />

        <aside className="space-y-6 lg:sticky lg:top-8">
          <section className={panelClass}>
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--ozer-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--ozer-text-on-light)]">
                Meeting info
              </h2>
            </div>

            <div className="space-y-4">
              {(meeting.business || meeting.client) && (
                <div className="space-y-3">
                  {meeting.business ? (
                    <PartyRow party={meeting.business} label="From" />
                  ) : null}
                  {meeting.client ? (
                    <PartyRow party={meeting.client} label="Client" />
                  ) : null}
                </div>
              )}

              <dl className="space-y-2 text-sm">
                {dateLabel ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--ozer-text-on-light-muted)]">
                      Date
                    </dt>
                    <dd className="text-right font-medium text-[var(--ozer-text-on-light)]">
                      {dateLabel}
                    </dd>
                  </div>
                ) : null}
                {meeting.showTasks && meeting.tasks.length > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--ozer-text-on-light-muted)]">
                      Open tasks
                    </dt>
                    <dd className="text-right font-medium text-[var(--ozer-text-on-light)]">
                      {openTaskCount}
                    </dd>
                  </div>
                ) : null}
                {meeting.attendeeEmails.length > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--ozer-text-on-light-muted)]">
                      Invitees
                    </dt>
                    <dd className="text-right font-medium text-[var(--ozer-text-on-light)]">
                      {meeting.attendeeEmails.length}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {participantNames.length > 0 ? (
                <div className="border-t border-[color:var(--ozer-border-on-light)] pt-3">
                  <p className="mb-2 text-[11px] tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                    Participants
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {participantNames.map((name) => (
                      <li
                        key={name}
                        className="rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-2.5 py-1 text-xs font-medium text-[var(--ozer-plum-700)]"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : meeting.attendeeEmails.length > 0 ? (
                <div className="border-t border-[color:var(--ozer-border-on-light)] pt-3">
                  <p className="mb-2 text-[11px] tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                    Participants
                  </p>
                  <ul className="space-y-1">
                    {meeting.attendeeEmails.map((email) => (
                      <li
                        key={email}
                        className="truncate text-sm text-[var(--ozer-plum-700)]"
                      >
                        {email}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {footerNote !== null ? (
        <p className="pb-2 text-center text-xs text-[var(--ozer-text-on-light-muted)]">
          {footerNote ??
            `Shared meeting notes${meeting.business ? ` · ${meeting.business.name}` : ''}`}
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-6">{body}</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-text-on-light)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        {body}
      </div>
    </main>
  );
}
