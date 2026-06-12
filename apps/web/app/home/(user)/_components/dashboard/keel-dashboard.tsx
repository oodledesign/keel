'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import { ArrowRight, Cake, CalendarClock, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';

import pathsConfig from '~/config/paths.config';

import { DashboardShortcutsBar } from '~/components/dashboard-shortcuts/dashboard-shortcuts-bar';

import type {
  KeelDashboardData,
  PersonalCalendarEvent,
  PersonalPeopleUpcomingItem,
  WorkspaceOverviewCard,
} from '../../_lib/server/keel-dashboard.loader';

import { PersonalDashboardTaskRow } from './personal-dashboard-task-row';
import { ConnectedWorkspacesBar } from './connected-workspaces-bar';

const panelClass =
  'rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)]';

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
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <DashboardSection
            title="Today's Focus"
            subtitle={
              data.includeWorkspaceTasks
                ? 'Due today across personal life and your workspaces'
                : 'Due today in your personal life areas'
            }
          >
            {data.todaysFocus.length > 0 ? (
              <div className="space-y-2">
                {data.todaysFocus.map((task) => (
                  <PersonalDashboardTaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <EmptyPanel message="Nothing due today. Enjoy the breathing room." />
            )}
          </DashboardSection>

          <DashboardSection
            title="Upcoming"
            subtitle={
              data.includeWorkspaceTasks
                ? 'Next up everywhere you work in Keel'
                : 'Next up in your personal areas'
            }
          >
            {data.upcoming.length > 0 ? (
              <div className="space-y-2">
                {data.upcoming.map((task) => (
                  <PersonalDashboardTaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <EmptyPanel message="No upcoming tasks scheduled." />
            )}
          </DashboardSection>

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
  props: React.PropsWithChildren<{ title: string; subtitle?: string }>,
) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-tight text-white">
          {props.title}
        </h2>
        {props.subtitle ? (
          <p className="mt-0.5 text-xs text-white/45">{props.subtitle}</p>
        ) : null}
      </div>
      {props.children}
    </section>
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
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="w-14 shrink-0 text-sm font-medium tabular-nums text-[#2A9D8F]">
        {props.event.timeLabel || '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{props.event.title}</p>
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
        <p className="text-xs text-zinc-400">{props.item.label}</p>
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
