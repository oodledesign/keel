import { notFound } from 'next/navigation';

import { CheckSquare, FileText, Sparkles } from 'lucide-react';

import { MeetingSummaryMarkdown } from '~/components/meetings/meeting-summary-markdown';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPublicMeetingByToken } from '~/lib/recorder/public-meeting.loader';

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
    'rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white/70 p-5 shadow-sm';

  return (
    <main className="min-h-screen bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <p className="text-xs tracking-wide text-[var(--ozer-text-muted)] uppercase">
            Meeting notes
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-plum-900)]">
            {meeting.title}
          </h1>
          {dateLabel ? (
            <p className="text-sm text-[var(--ozer-text-muted)]">{dateLabel}</p>
          ) : null}
          {meeting.attendeeEmails.length > 0 ? (
            <p className="text-sm text-[var(--ozer-text-muted)]">
              {meeting.attendeeEmails.length} attendee
              {meeting.attendeeEmails.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </header>

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

        {meeting.tasks.length > 0 ? (
          <section className={panelClass}>
            <div className="mb-4 flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-[var(--ozer-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                Tasks
              </h2>
            </div>
            <ul className="space-y-3">
              {meeting.tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-4 py-3"
                >
                  <p className="text-sm font-medium text-[var(--ozer-plum-900)]">
                    {task.title}
                  </p>
                  {task.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ozer-text-muted)]">
                      {task.description}
                    </p>
                  ) : null}
                  {task.dueDate ? (
                    <p className="mt-2 text-xs text-[var(--ozer-text-muted)]">
                      Due {formatDueDate(task.dueDate)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={panelClass}>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--ozer-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--ozer-plum-900)]">
              Transcript
            </h2>
          </div>
          <div className="max-h-[min(70vh,640px)] space-y-4 overflow-auto text-sm leading-relaxed text-[var(--ozer-plum-900)]">
            {meeting.speakerSegments.length > 0 ? (
              meeting.speakerSegments.map((segment, index) => (
                <div key={`${segment.speaker}-${index}`}>
                  <p className="text-xs font-semibold tracking-wide text-[var(--ozer-accent)] uppercase">
                    {segment.speaker}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{segment.text}</p>
                </div>
              ))
            ) : (
              <p className="whitespace-pre-wrap">
                {meeting.content || 'No transcript available.'}
              </p>
            )}
          </div>
        </section>

        <p className="pb-8 text-center text-xs text-[var(--ozer-text-muted)]">
          Shared meeting notes
        </p>
      </div>
    </main>
  );
}

export default withI18n(PublicMeetingPage);
