'use client';

import { useMemo, useState, useTransition } from 'react';

import { Quote } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  type PhraseToken,
  parsePhraseTokens,
  resolvePhraseBody,
} from '~/lib/building-surveyor/phrase-tokens';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import type { SurveyPhrase } from '../_lib/schema/survey-phrases.schema';
import { listSurveyPhrasesAction } from '../_lib/server/survey-phrase-actions';

export function PhraseResolver({
  tokens,
  answers,
  onAnswer,
  onInsert,
}: {
  tokens: PhraseToken[];
  answers: string[];
  onAnswer: (next: string[]) => void;
  onInsert: () => void;
}) {
  const indexed = tokens.reduce<
    Array<{ token: PhraseToken; slot: number | null }>
  >((acc, token) => {
    const slot =
      token.type === 'text'
        ? null
        : acc.filter((item) => item.slot !== null).length;
    acc.push({ token, slot });
    return acc;
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-[var(--workspace-shell-text)]">
        {indexed.map(({ token, slot }, index) => {
          if (token.type === 'text') {
            return <span key={index}>{token.value}</span>;
          }
          const current = slot ?? 0;
          if (token.type === 'choice') {
            return (
              <span key={index} className="mx-0.5 inline-flex flex-wrap gap-1">
                {token.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                      answers[current] === option
                        ? 'border-[var(--ozer-accent)] bg-[var(--workspace-shell-sidebar-accent)]'
                        : 'border-[color:var(--workspace-shell-border)]'
                    }`}
                    onClick={() => {
                      const next = [...answers];
                      next[current] = option;
                      onAnswer(next);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </span>
            );
          }
          return (
            <input
              key={index}
              value={answers[current] ?? ''}
              placeholder={token.label}
              className="mx-0.5 inline-block w-28 rounded border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-1 py-0.5 text-[11px]"
              onChange={(event) => {
                const next = [...answers];
                next[current] = event.target.value;
                onAnswer(next);
              }}
            />
          );
        })}
      </p>
      <Button
        type="button"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onInsert}
      >
        Insert
      </Button>
    </div>
  );
}

export function SurveyPhraseInsert({
  accountId,
  ricsCode,
  sectionKey,
  onInsert,
}: {
  accountId: string;
  ricsCode?: string | null;
  sectionKey: string;
  onInsert: (body: string, defaultRating?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [phrases, setPhrases] = useState<SurveyPhrase[]>([]);
  const [selected, setSelected] = useState<SurveyPhrase | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const loadPhrases = (nextQuery = query) => {
    startTransition(async () => {
      try {
        const rows = await listSurveyPhrasesAction({
          accountId,
          ricsCode: ricsCode ?? undefined,
          sectionKey: ricsCode ? undefined : sectionKey,
          query: nextQuery.trim() || undefined,
        });
        setPhrases(rows);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const tokens = useMemo(
    () => (selected ? parsePhraseTokens(selected.body) : []),
    [selected],
  );

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => {
          const next = !open;
          setOpen(next);
          setSelected(null);
          if (next) loadPhrases();
        }}
      >
        <Quote className="mr-1 h-3.5 w-3.5" />
        Insert phrase
      </Button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-md border border-[color:var(--workspace-shell-border)] p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => loadPhrases()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                loadPhrases();
              }
            }}
            placeholder="Search phrases…"
            className="h-8 text-xs"
          />
          {pending ? (
            <p className={`text-xs ${workspaceTextMuted}`}>Loading…</p>
          ) : phrases.length === 0 ? (
            <p className={`text-xs ${workspaceTextMuted}`}>
              No phrases for this section yet. Import a GoReport bank in
              settings.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-auto">
              {phrases.map((phrase) => (
                <li key={phrase.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left text-xs hover:bg-[var(--workspace-shell-sidebar-accent)]"
                    onClick={() => {
                      setSelected(phrase);
                      setAnswers(
                        parsePhraseTokens(phrase.body)
                          .filter((token) => token.type !== 'text')
                          .map((token) =>
                            token.type === 'choice' &&
                            token.defaultIndex !== null
                              ? (token.options[token.defaultIndex] ?? '')
                              : '',
                          ),
                      );
                    }}
                  >
                    {phrase.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected ? (
            <PhraseResolver
              tokens={tokens}
              answers={answers}
              onAnswer={setAnswers}
              onInsert={() => {
                onInsert(
                  resolvePhraseBody(selected.body, answers),
                  selected.defaultRating,
                );
                setOpen(false);
                setSelected(null);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
