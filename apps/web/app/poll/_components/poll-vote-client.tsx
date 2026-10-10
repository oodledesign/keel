'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import {
  formatPollClock,
  formatPollDay,
  formatPollWhen,
  formatPollZoneLabel,
} from '~/home/[account]/scheduling/_lib/format-poll-time';
import type { BrandFonts } from '~/lib/brand/brand-fonts.shared';
import { brandFontStyle } from '~/lib/brand/brand-fonts.web';

import { readableOn } from '../_lib/readable-on';
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
  fonts: BrandFonts;
  slots: Array<{ id: string; startsAt: string; endsAt: string }>;
  participants: Array<{
    inviteeId: string;
    label: string;
    isYou: boolean;
    answers: Array<{ slotId: string; answer: Answer }>;
  }>;
  counts: Array<{ slotId: string; yes: number; ifNeedBe: number; no: number }>;
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

export function PollVoteClient({ page }: { page: VotePage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thanksOpen, setThanksOpen] = useState(false);
  const detectedZone = useSyncExternalStore(
    emptySubscribe,
    readLocalTimeZone,
    () => null,
  );
  const voterZone = detectedZone ?? page.organiserTimezone;
  const [name, setName] = useState(page.yourName);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);
  useEffect(() => {
    updateEdges();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [updateEdges, page.slots.length]);
  const [editingName, setEditingName] = useState(!page.yourName.trim());
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
  const answeredCount = page.slots.filter((slot) => answers[slot.id]).length;

  function persist(next: Record<string, Answer>, slotIds: string[]) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Add your name first so we know who answered');
      return;
    }

    const wasComplete = page.slots.every((slot) => answers[slot.id]);

    startTransition(async () => {
      try {
        const result = await submitPollVoteAction({
          token: page.token,
          name: trimmed,
          answers: slotIds.map((slotId) => ({
            slotId,
            answer: next[slotId]!,
          })),
        });
        if (result.complete && !wasComplete) {
          setThanksOpen(true);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save');
      }
    });
  }

  function choose(slotId: string, answer: Answer) {
    const next = { ...answers, [slotId]: answer };
    setAnswers(next);
    persist(next, [slotId]);
  }

  function saveName() {
    const existing = page.slots
      .filter((slot) => answers[slot.id])
      .map((slot) => slot.id);
    if (existing.length === 0 || name.trim() === page.yourName.trim()) return;
    persist(answers, existing);
  }

  const onBrand = readableOn(page.primaryColor);

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
        <div className="mt-4 rounded-2xl border-2 border-[#86EFAC] bg-[#DCFCE7] px-4 py-4 text-[#166534]">
          <p className="text-xs font-bold tracking-wider uppercase">
            The time is confirmed
          </p>
          <p className="mt-1 text-xl font-bold">
            {formatPollWhen(chosen.startsAt, voterZone)} your time
          </p>
          {voterZone !== page.organiserTimezone ? (
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
          {page.location && page.location !== page.conferencingUrl ? (
            <p className="mt-1">{page.location}</p>
          ) : null}
        </div>
      ) : null}

      {page.canVote ? (
        <div className="mt-6 rounded-2xl border border-[#E7D7CC] bg-white p-4">
          {editingName ? (
            <>
              <label className="block text-sm font-medium" htmlFor="voter-name">
                Your name
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="voter-name"
                  value={name}
                  autoFocus={Boolean(page.yourName.trim())}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={saveName}
                  className="h-11 w-full rounded-xl border border-[#E7D7CC] bg-white px-3"
                />
                {name.trim() ? (
                  <button
                    type="button"
                    className="h-11 shrink-0 rounded-xl border border-[#E7D7CC] px-4 text-sm font-medium"
                    onClick={() => {
                      saveName();
                      setEditingName(false);
                    }}
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[#6B5B63]">Responding as</p>
                <p className="text-lg font-semibold">{name}</p>
              </div>
              <button
                type="button"
                className="h-9 shrink-0 rounded-xl border border-[#E7D7CC] px-4 text-sm font-medium"
                onClick={() => setEditingName(true)}
              >
                Edit name
              </button>
            </div>
          )}
          <p className="mt-2 text-sm text-[#6B5B63]">
            Pick an answer for each time below. Each choice saves straight away
            ({answeredCount} of {page.slots.length} answered), and you can
            change it any time until a time is chosen.
          </p>
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
            busy={pending}
            onAnswer={(answer) => choose(slot.id, answer)}
          />
        ))}
      </div>

      <div className="relative mt-6 hidden md:block">
        <div
          ref={scrollRef}
          onScroll={updateEdges}
          className="overflow-x-auto rounded-2xl border border-[#E7D7CC] bg-white"
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E7D7CC] text-left">
                <th className="px-3 py-2"> </th>
                {page.slots.map((slot) => {
                  const isChosen = slot.id === page.chosenSlotId;
                  return (
                    <th
                      key={slot.id}
                      className="px-3 py-2 whitespace-nowrap"
                      style={
                        isChosen
                          ? { backgroundColor: '#DCFCE7', color: '#166534' }
                          : undefined
                      }
                    >
                      <span className="block">
                        {formatPollDay(slot.startsAt, voterZone)}
                      </span>
                      <span className="block font-semibold">
                        {formatPollClock(slot.startsAt, voterZone)}
                      </span>
                      {isChosen ? (
                        <span className="block text-xs font-bold">
                          Chosen time
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
                  style={
                    person.isYou
                      ? {
                          backgroundColor: `${page.primaryColor}1F`,
                          boxShadow: `inset 4px 0 0 ${page.primaryColor}`,
                        }
                      : undefined
                  }
                >
                  <th
                    className={`px-3 py-2 text-left whitespace-nowrap ${person.isYou ? 'font-bold' : 'font-medium'}`}
                  >
                    {person.label}
                  </th>
                  {page.slots.map((slot) => {
                    const answer = person.isYou
                      ? answers[slot.id]
                      : person.answers.find((row) => row.slotId === slot.id)
                          ?.answer;
                    return (
                      <td key={slot.id} className="px-2 py-2">
                        {person.isYou && page.canVote ? (
                          <AnswerSelect
                            value={answer}
                            label={`${formatPollDay(slot.startsAt, voterZone)} ${formatPollClock(slot.startsAt, voterZone)}`}
                            onChange={(next) => choose(slot.id, next)}
                          />
                        ) : (
                          <AnswerPill answer={answer} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  Yes
                </th>
                {page.slots.map((slot) => (
                  <td key={slot.id} className="px-3 py-2">
                    <TotalPill
                      answer="yes"
                      value={counts.get(slot.id)?.yes ?? 0}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  If need be
                </th>
                {page.slots.map((slot) => (
                  <td key={slot.id} className="px-3 py-2">
                    <TotalPill
                      answer="if_need_be"
                      value={counts.get(slot.id)?.ifNeedBe ?? 0}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {edges.left ? (
          <div className="pointer-events-none absolute inset-y-px left-px w-12 rounded-l-2xl bg-gradient-to-r from-white to-transparent" />
        ) : null}
        {edges.right ? (
          <div className="pointer-events-none absolute inset-y-px right-px flex w-20 items-center justify-end rounded-r-2xl bg-gradient-to-l from-white via-white/80 to-transparent pr-2">
            <span className="rounded-full border border-[#E7D7CC] bg-white px-2 py-1 text-xs font-semibold text-[#6B5B63] shadow-sm">
              More →
            </span>
          </div>
        ) : null}
      </div>

      {page.showVoterNames ? null : (
        <p className="mt-3 text-sm text-[#6B5B63]">
          Other people&apos;s names are hidden. You can see how many said yes or
          if need be.
        </p>
      )}

      <Dialog open={thanksOpen} onOpenChange={setThanksOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thanks, your answers are in</DialogTitle>
            <DialogDescription>
              {page.brandName} will pick a time once everyone has replied. You
              can come back to this same link and change your answers any time
              before the time is chosen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="h-11 rounded-xl px-6"
              style={{ backgroundColor: page.primaryColor, color: onBrand }}
              onClick={() => setThanksOpen(false)}
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  busy,
  onAnswer,
}: {
  slot: { id: string; startsAt: string };
  voterZone: string;
  organiserZone: string;
  answer?: Answer;
  count?: { yes: number; ifNeedBe: number; no: number };
  chosen: boolean;
  disabled: boolean;
  busy: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  return (
    <article
      className="rounded-2xl border bg-white p-4"
      style={{
        borderColor: chosen ? '#86EFAC' : '#E7D7CC',
        backgroundColor: chosen ? '#F0FDF4' : '#FFFFFF',
      }}
    >
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
      {chosen ? (
        <p className="mt-1 text-sm font-bold text-[#166534]">Chosen time</p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <TotalPill answer="yes" value={count?.yes ?? 0} withLabel />
        <TotalPill answer="if_need_be" value={count?.ifNeedBe ?? 0} withLabel />
      </div>
      <div className="mt-3">
        {disabled ? (
          <AnswerPill answer={answer} />
        ) : (
          <AnswerSelect
            value={answer}
            busy={busy}
            label={`${formatPollDay(slot.startsAt, voterZone)} ${formatPollClock(slot.startsAt, voterZone)}`}
            onChange={onAnswer}
          />
        )}
      </div>
    </article>
  );
}

function AnswerSelect({
  value,
  label,
  busy,
  onChange,
}: {
  value?: Answer;
  label: string;
  busy?: boolean;
  onChange: (answer: Answer) => void;
}) {
  const style = value ? ANSWER_STYLE[value] : null;

  return (
    <select
      aria-label={`Your answer for ${label}`}
      value={value ?? ''}
      disabled={busy}
      onChange={(event) => onChange(event.target.value as Answer)}
      className="h-10 w-full min-w-[7.5rem] cursor-pointer rounded-xl border px-2 text-sm font-semibold"
      style={{
        backgroundColor: style?.bg ?? '#FFFFFF',
        color: style?.fg ?? '#6B5B63',
        borderColor: style?.border ?? '#E7D7CC',
      }}
    >
      <option value="" disabled>
        Choose…
      </option>
      <option value="yes">Yes</option>
      <option value="if_need_be">If need be</option>
      <option value="no">No</option>
    </select>
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
  withLabel,
}: {
  answer: 'yes' | 'if_need_be';
  value: number;
  withLabel?: boolean;
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
      {withLabel ? ` ${style.label.toLowerCase()}` : ''}
    </span>
  );
}

function emptySubscribe() {
  return () => {};
}

function readLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}
