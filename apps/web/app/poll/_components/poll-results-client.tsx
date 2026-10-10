'use client';

import { useSyncExternalStore } from 'react';

import {
  formatPollClock,
  formatPollDay,
  formatPollWhen,
  formatPollZoneLabel,
} from '~/home/[account]/scheduling/_lib/format-poll-time';
import type { BrandFonts } from '~/lib/brand/brand-fonts.shared';
import { brandFontStyle } from '~/lib/brand/brand-fonts.web';

import { readableOn } from '../_lib/readable-on';

type Answer = 'yes' | 'if_need_be' | 'no';

type ResultsPage = {
  title: string;
  description: string | null;
  location: string | null;
  durationMinutes: number;
  organiserTimezone: string;
  pollStatus: 'open' | 'closed' | 'cancelled';
  slots: Array<{
    id: string;
    startsAt: string;
    rank: number;
    yes: number;
    ifNeedBe: number;
    no: number;
    pending: number;
  }>;
  participants: Array<{
    inviteeId: string;
    label: string;
    responded: boolean;
    answers: Array<{ slotId: string; answer: Answer }>;
  }>;
  respondedCount: number;
  chosenSlotId: string | null;
  conferencingUrl: string | null;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  fonts: BrandFonts;
  organiserName: string;
  organiserEmail: string | null;
};

const ANSWER_STYLE: Record<
  Answer,
  { label: string; bg: string; fg: string; border: string }
> = {
  yes: { label: 'Yes', bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
  if_need_be: {
    label: 'If need be',
    bg: '#FEF3C7',
    fg: '#92400E',
    border: '#FCD34D',
  },
  no: { label: 'No', bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5' },
};

const BEST_COUNT = 3;

export function PollResultsClient({ page }: { page: ResultsPage }) {
  const detectedZone = useSyncExternalStore(
    emptySubscribe,
    readLocalTimeZone,
    () => null,
  );
  const viewerZone = detectedZone ?? page.organiserTimezone;
  const onBrand = readableOn(page.primaryColor);

  const answerFor = new Map<string, Answer>();
  for (const person of page.participants) {
    for (const row of person.answers) {
      answerFor.set(`${person.inviteeId}:${row.slotId}`, row.answer);
    }
  }

  const chosen = page.slots.find((slot) => slot.id === page.chosenSlotId);
  const best = [...page.slots]
    .sort((left, right) => left.rank - right.rank)
    .slice(0, BEST_COUNT);
  const total = page.participants.length;
  const partlyAnswered = page.participants.filter(
    (person) => !person.responded && person.answers.length > 0,
  ).length;
  const mailto = page.organiserEmail
    ? `mailto:${page.organiserEmail}?subject=${encodeURIComponent(`Final time for ${page.title}`)}`
    : null;

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6"
      style={brandFontStyle(page.fonts)}
    >
      <header
        className="mb-6 rounded-2xl px-4 py-4"
        style={{ backgroundColor: page.primaryColor, color: onBrand }}
      >
        {page.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.logoUrl}
            alt=""
            className="mb-3 h-10 w-auto max-w-[180px] object-contain"
          />
        ) : (
          <p className="text-sm font-medium opacity-90">{page.brandName}</p>
        )}
        <p className="text-xs font-bold tracking-wider uppercase opacity-80">
          Availability
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {page.title}
        </h1>
        {page.description ? (
          <p className="mt-2 text-sm opacity-90">{page.description}</p>
        ) : null}
      </header>

      <p className="text-sm text-[#6B5B63]">
        {page.durationMinutes} minutes
        {page.location ? ` · ${page.location}` : ''} · {page.brandName}
      </p>
      <p className="mt-1 text-sm text-[#6B5B63]">
        Times shown in your timezone,{' '}
        {formatPollZoneLabel(
          page.slots[0]?.startsAt ?? new Date().toISOString(),
          viewerZone,
        )}
        .
        {viewerZone !== page.organiserTimezone
          ? ` The organiser is in ${page.organiserTimezone}.`
          : ''}
      </p>

      {page.pollStatus === 'cancelled' ? (
        <p className="mt-4 rounded-xl border border-[#E7D7CC] bg-white px-4 py-3">
          This poll was cancelled.
        </p>
      ) : null}

      {page.pollStatus === 'closed' && chosen ? (
        <div className="mt-4 rounded-2xl border-2 border-[#86EFAC] bg-[#DCFCE7] px-4 py-4 text-[#166534]">
          <p className="text-xs font-bold tracking-wider uppercase">
            The time is confirmed
          </p>
          <p className="mt-1 text-xl font-bold">
            {formatPollWhen(chosen.startsAt, viewerZone)} your time
          </p>
          {viewerZone !== page.organiserTimezone ? (
            <p className="text-sm">
              {formatPollWhen(chosen.startsAt, page.organiserTimezone)}{' '}
              {page.organiserTimezone}
            </p>
          ) : null}
          {page.conferencingUrl ? (
            <a
              className="mt-2 inline-block font-medium underline"
              href={page.conferencingUrl}
            >
              {page.conferencingUrl}
            </a>
          ) : null}
        </div>
      ) : null}

      {page.pollStatus === 'open' ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7D7CC] bg-white p-4">
          <div>
            <p className="font-semibold">
              {total > 0 && page.respondedCount === total
                ? 'Everyone has answered'
                : `${page.respondedCount} of ${total} ${total === 1 ? 'person has' : 'people have'} answered every time`}
              {partlyAnswered > 0 ? (
                <span className="font-normal text-[#6B5B63]">
                  {' '}
                  · {partlyAnswered} partly answered
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-[#6B5B63]">
              {page.organiserName} shared this so you can choose the final time.
              It updates as more answers come in. When you have decided, let{' '}
              {page.organiserName} know.
            </p>
          </div>
          {mailto ? (
            <a
              href={mailto}
              className="inline-flex h-11 shrink-0 items-center rounded-xl px-5 text-sm font-semibold"
              style={{ backgroundColor: page.primaryColor, color: onBrand }}
            >
              Email {page.organiserName}
            </a>
          ) : null}
        </div>
      ) : null}

      {page.pollStatus === 'open' && best.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Best times</h2>
          <p className="text-sm text-[#6B5B63]">
            Ranked by most yes, then if need be, then fewest no.
          </p>
          <ol className="mt-3 grid gap-3 md:grid-cols-3">
            {best.map((slot) => (
              <BestTimeCard
                key={slot.id}
                slot={slot}
                viewerZone={viewerZone}
                organiserZone={page.organiserTimezone}
                participants={page.participants}
                answerFor={answerFor}
              />
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Everyone&apos;s answers</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E7D7CC] bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E7D7CC] text-left">
                <th className="sticky left-0 bg-white px-3 py-2"> </th>
                {page.slots.map((slot) => {
                  const isChosen = slot.id === page.chosenSlotId;
                  const isBest =
                    page.pollStatus === 'open' &&
                    slot.rank === 1 &&
                    slot.yes + slot.ifNeedBe > 0;
                  return (
                    <th
                      key={slot.id}
                      className="px-3 py-2 whitespace-nowrap"
                      style={
                        isChosen || isBest
                          ? { backgroundColor: '#DCFCE7', color: '#166534' }
                          : undefined
                      }
                    >
                      <span className="block">
                        {formatPollDay(slot.startsAt, viewerZone)}
                      </span>
                      <span className="block font-semibold">
                        {formatPollClock(slot.startsAt, viewerZone)}
                      </span>
                      {isChosen || isBest ? (
                        <span className="block text-xs font-bold">
                          {isChosen ? 'Chosen time' : 'Best so far'}
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {page.participants.map((person) => (
                <tr
                  key={person.inviteeId}
                  className="border-b border-[#E7D7CC]"
                >
                  <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap">
                    <span className="block">{person.label}</span>
                    {!person.responded ? (
                      <span className="block text-xs font-normal text-[#6B5B63]">
                        {person.answers.length > 0
                          ? 'Partly answered'
                          : 'Not answered yet'}
                      </span>
                    ) : null}
                  </th>
                  {page.slots.map((slot) => (
                    <td key={slot.id} className="px-2 py-2">
                      <AnswerPill
                        answer={answerFor.get(`${person.inviteeId}:${slot.id}`)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {(['yes', 'if_need_be'] as const).map((kind) => (
                <tr key={kind}>
                  <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap">
                    {ANSWER_STYLE[kind].label}
                  </th>
                  {page.slots.map((slot) => (
                    <td key={slot.id} className="px-3 py-2">
                      <TotalPill
                        answer={kind}
                        value={kind === 'yes' ? slot.yes : slot.ifNeedBe}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-[#6B5B63]">
          This page is view only. Answers can only be changed by the people
          invited.
        </p>
      </section>
    </div>
  );
}

function BestTimeCard({
  slot,
  viewerZone,
  organiserZone,
  participants,
  answerFor,
}: {
  slot: ResultsPage['slots'][number];
  viewerZone: string;
  organiserZone: string;
  participants: ResultsPage['participants'];
  answerFor: Map<string, Answer>;
}) {
  const groups: Array<{ key: Answer | 'waiting'; label: string }> = [
    { key: 'yes', label: 'Available' },
    { key: 'if_need_be', label: 'If need be' },
    { key: 'no', label: 'Not available' },
    { key: 'waiting', label: 'Not answered' },
  ];

  const namesFor = (key: Answer | 'waiting') =>
    participants
      .filter((person) => {
        const answer = answerFor.get(`${person.inviteeId}:${slot.id}`);
        return key === 'waiting' ? !answer : answer === key;
      })
      .map((person) => ({ id: person.inviteeId, label: person.label }));

  return (
    <li className="rounded-2xl border border-[#E7D7CC] bg-white p-4">
      <p className="text-xs font-bold tracking-wider text-[#6B5B63] uppercase">
        #{slot.rank}
      </p>
      <p className="text-sm text-[#6B5B63]">
        {formatPollDay(slot.startsAt, viewerZone)}
      </p>
      <p className="text-lg font-semibold">
        {formatPollClock(slot.startsAt, viewerZone)}
      </p>
      {viewerZone !== organiserZone ? (
        <p className="text-xs text-[#6B5B63]">
          {formatPollClock(slot.startsAt, organiserZone)} {organiserZone}
        </p>
      ) : null}
      <dl className="mt-3 space-y-2">
        {groups.map((group) => {
          const names = namesFor(group.key);
          if (names.length === 0) return null;
          const style =
            group.key === 'waiting' ? null : ANSWER_STYLE[group.key];
          return (
            <div key={group.key}>
              <dt className="text-xs font-semibold text-[#6B5B63]">
                {group.label} ({names.length})
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {names.map((name) => (
                  <span
                    key={name.id}
                    className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: style?.bg ?? '#F3EEE8',
                      color: style?.fg ?? '#6B5B63',
                      borderColor: style?.border ?? '#E7D7CC',
                    }}
                  >
                    {name.label}
                  </span>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function AnswerPill({ answer }: { answer?: Answer }) {
  if (!answer) {
    return <span className="px-2 text-[#6B5B63]">—</span>;
  }
  const style = ANSWER_STYLE[answer];
  return (
    <span
      className="inline-block rounded-xl border px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
      style={{
        backgroundColor: style.bg,
        color: style.fg,
        borderColor: style.border,
      }}
    >
      {style.label}
    </span>
  );
}

function TotalPill({
  answer,
  value,
}: {
  answer: 'yes' | 'if_need_be';
  value: number;
}) {
  const style = ANSWER_STYLE[answer];
  return (
    <span
      className="inline-flex min-w-8 items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold"
      style={{
        backgroundColor: value > 0 ? style.bg : '#F3EEE8',
        color: value > 0 ? style.fg : '#6B5B63',
      }}
    >
      {value}
    </span>
  );
}

function emptySubscribe() {
  return () => {};
}

function readLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}
