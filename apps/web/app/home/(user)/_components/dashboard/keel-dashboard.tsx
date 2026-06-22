'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import { ArrowRight, Cake, CalendarClock, MessageSquare, StickyNote, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { buildBrainChatUrl } from '~/lib/brain/build-brain-chat-url';

import { DashboardShortcutsBar } from '~/components/dashboard-shortcuts/dashboard-shortcuts-bar';

import type {
  KeelDashboardData,
  PersonalCalendarEvent,
  PersonalDashboardTask,
  PersonalPeopleUpcomingItem,
  PersonalRecentNote,
  WorkspaceOverviewCard,
} from '../../_lib/server/keel-dashboard.loader';

import { PersonalDashboardTaskRow } from './personal-dashboard-task-row';
import { ConnectedWorkspacesBar } from './connected-workspaces-bar';

const panelClass =
  'rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)]';

const DASHBOARD_TASK_PREVIEW_LIMIT = 5;
const personalTasksHref = `${pathsConfig.app.home}/tasks`;

type Props = {
  data: KeelDashboardData;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function KeelDashboard({ data }: Props) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-x-hidden px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      <header className="space-y-4">
        <DashboardShortcutsBar
          shortcuts={data.dashboardShortcuts}
          settingsHref={pathsConfig.app.personalAccountSettings}
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {greeting}, {data.userName}
          </h1>
          <p className="mt-1 text-sm font-normal text-white/60">{data.dateLabel}</p>
        </div>
        {data.brainWorkspaceSlug ? (
          <Button
            asChild
            className="keel-gradient-btn w-full sm:w-auto"
          >
            <Link href={buildBrainChatUrl(data.brainWorkspaceSlug)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Ask Second Brain
            </Link>
          </Button>
        ) : null}
      </header>

      {data.recentNotes.length > 0 ? (
        <DashboardSection
          title="Recent notes"
          subtitle="Latest from personal and your workspaces"
        >
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
            {data.recentNotes.map((note) => (
              <RecentNoteCard key={`${note.workspaceSlug}-${note.id}`} note={note} />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <TaskPreviewSection
            title="Today's Focus"
            subtitle={
              data.includeWorkspaceTasks
                ? 'Due today across personal life and your workspaces'
                : 'Due today in your personal life areas'
            }
            tasks={data.todaysFocus}
            emptyMessage="Nothing due today. Enjoy the breathing room."
          />

          <TaskPreviewSection
            title="Upcoming"
            subtitle={
              data.includeWorkspaceTasks
                ? 'Next up everywhere you work in Ozer'
                : 'Next up in your personal areas'
            }
            tasks={data.upcoming}
            emptyMessage="No upcoming tasks scheduled."
          />

          <DashboardSection title="Upcoming with people">
            {data.peopleUpcoming.length > 0 ? (
              <div className={`${panelClass} divide-y divide-white/[0.06]`}>
                {data.peopleUpcoming.map((item) => (
                  <PeopleUpcomingRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyPanel message="Add people to track birthdays and catchups.">
                <Link
                  href={pathsConfig.app.personalPeople}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#2A9D8F] hover:text-[#34b3a4]"
                >
                  Open People
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </EmptyPanel>
            )}
          </DashboardSection>
        </div>

        <div className="min-w-0">
          <DashboardSection title="My Day">
          {data.myDayEvents.length > 0 ? (
            <div className={`${panelClass} divide-y divide-white/[0.06]`}>
              {data.myDayEvents.map((event) => (
                <CalendarEventRow key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyPanel message="No events on your calendar today." />
          )}
          </DashboardSection>
        </div>
      </div>

      <DashboardSection title="Workspace overview">
        {data.workspaceOverview.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.workspaceOverview.map((card) => (
              <WorkspaceOverviewCardView key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="Join or create a workspace to see an overview here." />
        )}
      </DashboardSection>

      <ConnectedWorkspacesBar
        cards={data.workspaceOverview}
        includeWorkspaceTasks={data.includeWorkspaceTasks}
        settingsHref={pathsConfig.app.personalAccountSettings}
      />
    </div>
  );
}

function DashboardSection(
  props: React.PropsWithChildren<{
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
  }>,
) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-white">
            {props.title}
          </h2>
          {props.subtitle ? (
            <p className="mt-0.5 text-xs text-white/45">{props.subtitle}</p>
          ) : null}
        </div>
        {props.action ? <div className="shrink-0">{props.action}</div> : null}
      </div>
      {props.children}
    </section>
  );
}

function ViewAllTasksLink() {
  return (
    <Link
      href={personalTasksHref}
      className="inline-flex items-center gap-1 text-xs font-medium text-[#2A9D8F] hover:text-[#34b3a4]"
    >
      View all
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function TaskPreviewSection({
  title,
  subtitle,
  tasks,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  tasks: PersonalDashboardTask[];
  emptyMessage: string;
}) {
  const visibleTasks = tasks.slice(0, DASHBOARD_TASK_PREVIEW_LIMIT);
  const hasMore = tasks.length > DASHBOARD_TASK_PREVIEW_LIMIT;

  return (
    <DashboardSection
      title={title}
      subtitle={subtitle}
      action={hasMore ? <ViewAllTasksLink /> : null}
    >
      {visibleTasks.length > 0 ? (
        <div className="space-y-2">
          {visibleTasks.map((task) => (
            <PersonalDashboardTaskRow key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <EmptyPanel message={emptyMessage} />
      )}
    </DashboardSection>
  );
}

function EmptyPanel(
  props: React.PropsWithChildren<{ message: string }>,
) {
  return (
    <div className={`${panelClass} px-4 py-8 text-center text-sm text-white/50`}>
      {props.message}
      {props.children}
    </div>
  );
}

function CalendarEventRow(props: { event: PersonalCalendarEvent }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3">
      <span className="w-14 shrink-0 text-sm font-medium tabular-nums text-[#2A9D8F]">
        {props.event.timeLabel || '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{props.event.title}</p>
        <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-white/60">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: props.event.workspaceColor }}
          />
          {props.event.workspaceName}
        </span>
      </div>
    </div>
  );
}

function PeopleUpcomingRow(props: { item: PersonalPeopleUpcomingItem }) {
  const Icon =
    props.item.kind === 'catchup'
      ? CalendarClock
      : props.item.kind === 'birthday'
        ? Cake
        : Users;

  return (
    <Link
      href={props.item.href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--keel-teal)]/10 text-[#5eead4]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {props.item.name}
        </p>
        <p className="truncate text-xs text-zinc-400">{props.item.label}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
    </Link>
  );
}

function WorkspaceOverviewCardView(props: { card: WorkspaceOverviewCard }) {
  const { card } = props;
  const href = pathsConfig.app.accountHome.replace('[account]', card.slug);
  const initial = (card.name.trim()[0] ?? '?').toUpperCase();

  return (
    <div className={panelClass}>
      <div className="flex flex-col gap-4 p-5">
        <dl className="grid grid-cols-2 gap-3">
          {card.stats.map((stat) => {
            const isPipeline = stat.label === 'Pipeline value';

            return (
              <div
                key={stat.label}
                className="rounded-lg border border-white/[0.06] bg-[var(--workspace-shell-canvas)] px-3 py-2"
              >
                <dt className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-white/45">
                  {isPipeline ? (
                    <Avatar className="h-5 w-5 rounded-md">
                      <AvatarImage src={card.pictureUrl ?? undefined} alt="" />
                      <AvatarFallback
                        className="rounded-md text-[9px] font-semibold text-white"
                        style={{ backgroundColor: card.color }}
                      >
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                  <span>{isPipeline ? 'Pipeline' : stat.label}</span>
                </dt>
                <dd className="mt-0.5 text-lg font-semibold text-white">
                  {stat.value}
                </dd>
              </div>
            );
          })}
        </dl>

        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#2A9D8F] hover:text-[#34b3a4]"
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function RecentNoteCard(props: { note: PersonalRecentNote }) {
  const href = props.note.isPersonal
    ? pathsConfig.app.personalNoteDetail.replace('[noteId]', props.note.id)
    : pathsConfig.app.accountNoteDetail
        .replace('[account]', props.note.workspaceSlug)
        .replace('[noteId]', props.note.id);

  return (
    <Link
      href={href}
      className={`${panelClass} w-[calc(50%-0.375rem)] shrink-0 snap-start p-3 transition-transform active:scale-[0.98] md:w-auto`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/8 text-[#5eead4]">
          <StickyNote className="h-3.5 w-3.5" />
        </div>
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[10px] text-white/50">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: props.note.workspaceColor }}
          />
          {props.note.workspaceName}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-medium text-white">
        {props.note.title}
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
        {props.note.excerpt}
      </p>
    </Link>
  );
}
