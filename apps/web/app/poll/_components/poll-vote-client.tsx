'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

import {
  formatPollClock,
  formatPollDay,
  formatPollWhen,
  formatPollZoneLabel,
} from '~/home/[account]/scheduling/_lib/format-poll-time';

import { submitPollVoteAction } from '../_lib/server/public-poll-actions';

type Answer = 'yes' | 'if_need_be' | 'no';

type VotePage = {
  token: string;
  title: string;
  description: string | null;
  location: string | null;
  durationMinutes: number;
  organiserTimezone: string;
  showVoterNames: boolean;
  yourName: string;
  pollStatus: 'open' | 'closed' | 'cancelled';
  canVote: boolean;
  chosenSlotId: string | null;
  conferencingUrl: string | null;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  slots: Array<{ id: string; startsAt: string; endsAt: string }>;
  participants: Array<{
    inviteeId: string;
    label: string;
    isYou: boolean;
    answers: Array<{ slotId: string; answer: Answer }>;
  }>;
  counts: Array<{ slotId: string; yes: number; ifNeedBe: number; no: number }>;
};

export function PollVoteClient({ page }: { page: VotePage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const detectedZone = useSyncExternalStore(
    emptySubscribe,
    readLocalTimeZone,
    () => null,
  );
  const voterZone = detectedZone ?? page.organiserTimezone;
  const [name, setName] = useState(page.yourName);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const initial: Record<string, Answer> = {};
    const you = page.participants.find((row) => row.isYou);
    for (const answer of you?.answers ?? []) {
      initial[answer.slotId] = answer.answer;
    }
    return initial;
  });

  const counts = new Map(page.counts.map((row) => [row.slotId, row]));
  const chosen = page.slots.find((slot) => slot.id === page.chosenSlotId);

  function save() {
    startTransition(async () => {
      try {
        await submitPollVoteAction({
          token: page.token,
          name,
          answers: page.slots.map((slot) => ({
            slotId: slot.id,
            answer: answers[slot.id]!,
          })),
        });
        toast.success('Response saved');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save');
      }
    });
  }

  const missing = page.slots.some((slot) => !answers[slot.id]);
  const onBrand = readableOn(page.primaryColor);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
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
          voterZone,
        )}
        .
        {voterZone !== page.organiserTimezone
          ? ` The organiser is in ${page.organiserTimezone}.`
          : ''}
      </p>

      {page.pollStatus === 'cancelled' ? (
        <p className="mt-4 rounded-xl border border-[#E7D7CC] bg-white px-4 py-3">
          This poll was cancelled.
        </p>
      ) : null}

      {page.pollStatus === 'closed' && chosen ? (
        <div className="mt-4 rounded-xl border border-[#E7D7CC] bg-white px-4 py-3">
          <p className="font-medium">The time is confirmed</p>
          <p className="mt-1">
            {formatPollWhen(chosen.startsAt, voterZone)} your time
          </p>
          {voterZone !== page.organiserTimezone ? (
            <p className="text-sm text-[#6B5B63]">
              {formatPollWhen(chosen.startsAt, page.organiserTimezone)}{' '}
              {page.organiserTimezone}
            </p>
          ) : null}
          {page.conferencingUrl ? (
            <a
              className="mt-2 inline-block underline"
              href={page.conferencingUrl}
            >
              {page.conferencingUrl}
            </a>
          ) : null}
          {page.location && page.location !== page.conferencingUrl ? (
            <p className="mt-1">{page.location}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 space-y-3 md:hidden">
        {page.slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            voterZone={voterZone}
            organiserZone={page.organiserTimezone}
            answer={answers[slot.id]}
            count={counts.get(slot.id)}
            chosen={slot.id === page.chosenSlotId}
            disabled={!page.canVote}
            onAnswer={(answer) =>
              setAnswers((current) => ({ ...current, [slot.id]: answer }))
            }
          />
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-[#E7D7CC] bg-white md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7D7CC] text-left">
              <th className="px-3 py-2"> </th>
              {page.slots.map((slot) => (
                <th key={slot.id} className="px-3 py-2 whitespace-nowrap">
                  <span className="block">
                    {formatPollDay(slot.startsAt, voterZone)}
                  </span>
                  <span className="block font-semibold">
                    {formatPollClock(slot.startsAt, voterZone)}
                  </span>
                  {slot.id === page.chosenSlotId ? (
                    <span className="block text-xs">Chosen</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.participants.map((person) => (
              <tr key={person.inviteeId} className="border-b border-[#E7D7CC]">
                <th className="px-3 py-2 text-left font-medium">
                  {person.label}
                </th>
                {page.slots.map((slot) => {
                  const answer = person.isYou
                    ? answers[slot.id]
                    : person.answers.find((row) => row.slotId === slot.id)
                        ?.answer;
                  return (
                    <td key={slot.id} className="px-3 py-2">
                      {person.isYou && page.canVote ? (
                        <AnswerButtons
                          value={answers[slot.id]}
                          onChange={(next) =>
                            setAnswers((current) => ({
                              ...current,
                              [slot.id]: next,
                            }))
                          }
                        />
                      ) : (
                        answerLabel(answer)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th className="px-3 py-2 text-left font-medium">Yes</th>
              {page.slots.map((slot) => (
                <td key={slot.id} className="px-3 py-2">
                  {counts.get(slot.id)?.yes ?? 0}
                </td>
              ))}
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium">If need be</th>
              {page.slots.map((slot) => (
                <td key={slot.id} className="px-3 py-2">
                  {counts.get(slot.id)?.ifNeedBe ?? 0}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {page.showVoterNames ? null : (
        <p className="mt-3 text-sm text-[#6B5B63]">
          Other people&apos;s names are hidden. You can see how many said yes or
          if need be.
        </p>
      )}

      {page.canVote ? (
        <div className="sticky bottom-0 mt-6 border-t border-[#E7D7CC] bg-[#FBF6EC] py-4">
          <label className="block text-sm font-medium" htmlFor="voter-name">
            Your name
          </label>
          <input
            id="voter-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-[#E7D7CC] bg-white px-3"
          />
          <button
            type="button"
            disabled={pending || missing || name.trim().length === 0}
            onClick={save}
            className="mt-3 h-11 w-full rounded-xl disabled:opacity-50 sm:w-auto sm:px-6"
            style={{ backgroundColor: page.primaryColor, color: onBrand }}
          >
            Save response
          </button>
          {missing ? (
            <p className="mt-2 text-sm text-[#6B5B63]">
              Mark every time to save.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SlotCard({
  slot,
  voterZone,
  organiserZone,
  answer,
  count,
  chosen,
  disabled,
  onAnswer,
}: {
  slot: { id: string; startsAt: string };
  voterZone: string;
  organiserZone: string;
  answer?: Answer;
  count?: { yes: number; ifNeedBe: number; no: number };
  chosen: boolean;
  disabled: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  return (
    <article className="rounded-2xl border border-[#E7D7CC] bg-white p-4">
      <p className="text-sm text-[#6B5B63]">
        {formatPollDay(slot.startsAt, voterZone)}
      </p>
      <p className="text-lg font-semibold">
        {formatPollClock(slot.startsAt, voterZone)}
      </p>
      {voterZone !== organiserZone ? (
        <p className="text-xs text-[#6B5B63]">
          {formatPollClock(slot.startsAt, organiserZone)} {organiserZone}
        </p>
      ) : null}
      {chosen ? <p className="mt-1 text-sm font-medium">Chosen time</p> : null}
      <p className="mt-2 text-sm text-[#6B5B63]">
        {count?.yes ?? 0} yes · {count?.ifNeedBe ?? 0} if need be
      </p>
      {disabled ? (
        <p className="mt-2 text-sm">{answerLabel(answer)}</p>
      ) : (
        <div className="mt-3">
          <AnswerButtons value={answer} onChange={onAnswer} />
        </div>
      )}
    </article>
  );
}

function AnswerButtons({
  value,
  onChange,
}: {
  value?: Answer;
  onChange: (answer: Answer) => void;
}) {
  const options: Array<{ id: Answer; label: string }> = [
    { id: 'yes', label: 'Yes' },
    { id: 'if_need_be', label: 'If need be' },
    { id: 'no', label: 'No' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className="h-11 rounded-xl border text-sm"
            style={{
              borderColor: selected ? '#351E28' : '#E7D7CC',
              backgroundColor: selected ? '#351E28' : '#FFFFFF',
              color: selected ? '#FBF6EC' : '#351E28',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function emptySubscribe() {
  return () => {};
}

function readLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}

function answerLabel(answer?: Answer) {
  if (answer === 'yes') return 'Yes';
  if (answer === 'if_need_be') return 'If need be';
  if (answer === 'no') return 'No';
  return '—';
}

/** Dark text on pale brand colours, white text otherwise. */
function readableOn(hex: string) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return '#ffffff';

  const raw = match[1]!;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return luminance > 0.55 ? '#351E28' : '#ffffff';
}
