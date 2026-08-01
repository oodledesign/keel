import { notFound } from 'next/navigation';

import { CheckSquare, Circle, FileText, Sparkles } from 'lucide-react';

import { MeetingSummaryMarkdown } from '~/components/meetings/meeting-summary-markdown';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  type PublicMeetingParty,
  loadPublicMeetingByToken,
} from '~/lib/recorder/public-meeting.loader';

interface PublicMeetingPageProps {
  params: Promise<{ token: string }>;
}

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

function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function PartyBadge({
  party,
  label,
}: {
  party: PublicMeetingParty;
  label: string;
}) {
  const initial = party.name.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--ozer-border-on-light)] bg-white">
        {party.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={party.logoUrl}
            alt=""
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          <span className="text-sm font-semibold text-[var(--ozer-plum-900)]">
            {initial}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-[var(--ozer-text-muted)] uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-[var(--ozer-plum-900)]">
          {party.name}
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PublicMeetingPageProps) {
  const { token } = await params;
  const meeting = await loadPublicMeetingByToken(token);

  if (!meeting) {
    return {
      title: 'Meeting not found',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: meeting.title,
    description: meeting.summaryText
      ? meeting.summaryText.replace(/[#*_`]/g, '').slice(0, 160)
      : `Meeting notes for ${meeting.title}`,
    robots: { index: false, follow: false },
  };
}

async function PublicMeetingPage({ params }: PublicMeetingPageProps) {
  const { token } = await params;
  const meeting = await loadPublicMeetingByToken(token);

  if (!meeting) {
    notFound();
  }

  const dateLabel = formatMeetingDate(meeting.meetingDate);
  const panelClass =
    'rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white/80 p-5 shadow-sm';
  const openTaskCount = meeting.tasks.filter((task) => !task.completed).length;

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="space-y-5">
          {(meeting.business || meeting.client) && (
            <div className="grid gap-4 rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white/80 p-4 shadow-sm sm:grid-cols-2">
              {meeting.business ? (
                <PartyBadge party={meeting.business} label="From" />
              ) : (
                <div />
              )}
              {meeting.client ? (
                <PartyBadge party={meeting.client} label="Client" />
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs tracking-wide text-[var(--ozer-text-muted)] uppercase">
              Meeting notes
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-plum-900)]">
              {meeting.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--ozer-text-muted)]">
              {dateLabel ? <span>{dateLabel}</span> : null}
              {meeting.attendeeEmails.length > 0 ? (
                <span>
                  {meeting.attendeeEmails.length} attendee
                  {meeting.attendeeEmails.length === 1 ? '' : 's'}
                </span>
              ) : null}
              {meeting.tasks.length > 0 ? (
                <span>
                  {openTaskCount} open task
                  {openTaskCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="space-y-6">
            {meeting.summaryText ? (
              <section className={panelClass}>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                    Summary
                  </h2>
                </div>
                <MeetingSummaryMarkdown
                  markdown={meeting.summaryText}
                  variant="public"
                />
              </section>
            ) : null}

            <section className={panelClass}>
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--ozer-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                  Transcript
                </h2>
              </div>
              <div className="max-h-[min(70vh,720px)] space-y-4 overflow-auto text-sm leading-relaxed text-[var(--ozer-plum-900)]">
                {meeting.speakerSegments.length > 0 ? (
                  meeting.speakerSegments.map((segment, index) => (
                    <div key={`${segment.speaker}-${index}`}>
                      <p className="text-xs font-semibold tracking-wide text-[var(--ozer-plum-900)] uppercase">
                        {segment.speaker}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--ozer-plum-900)]/90">
                        {segment.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="whitespace-pre-wrap">
                    {meeting.content || 'No transcript available.'}
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-8">
            {meeting.tasks.length > 0 ? (
              <section className={panelClass}>
                <div className="mb-4 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[var(--ozer-accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                    Accepted tasks
                  </h2>
                </div>
                <ul className="space-y-3">
                  {meeting.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex gap-3 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-3 py-3"
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[color:var(--ozer-border-on-light)] bg-white"
                        aria-hidden
                      >
                        {task.completed ? (
                          <CheckSquare className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                        ) : (
                          <Circle className="h-3 w-3 text-[var(--ozer-text-muted)]" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={
                            task.completed
                              ? 'text-sm font-medium text-[var(--ozer-text-muted)] line-through'
                              : 'text-sm font-medium text-[var(--ozer-plum-900)]'
                          }
                        >
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="mt-1 text-sm leading-relaxed text-[var(--ozer-text-muted)]">
                            {task.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ozer-text-muted)]">
                          {task.dueDate ? (
                            <span>Due {formatDueDate(task.dueDate)}</span>
                          ) : null}
                          <span>{task.completed ? 'Completed' : 'Open'}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section className={panelClass}>
                <div className="mb-2 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[var(--ozer-accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                    Accepted tasks
                  </h2>
                </div>
                <p className="text-sm text-[var(--ozer-text-muted)]">
                  No accepted tasks from this meeting yet.
                </p>
              </section>
            )}
          </aside>
        </div>

        <p className="pb-8 text-center text-xs text-[var(--ozer-text-muted)]">
          Shared meeting notes
          {meeting.business ? ` · ${meeting.business.name}` : ''}
        </p>
      </div>
    </main>
  );
}

export default withI18n(PublicMeetingPage);
