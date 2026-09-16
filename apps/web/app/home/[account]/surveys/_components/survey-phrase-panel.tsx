'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Quote } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  SURVEY_PHRASE_DRAG_MIME,
  groupPhrasesBySectionCode,
  serializePhraseDrag,
} from '~/lib/building-surveyor/phrase-insert-blocks';
import {
  parsePhraseTokens,
  resolvePhraseBody,
} from '~/lib/building-surveyor/phrase-tokens';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

import type { SurveyPhrase } from '../_lib/schema/survey-phrases.schema';
import { listSurveyPhrasesAction } from '../_lib/server/survey-phrase-actions';
import { PhraseResolver } from './survey-phrase-insert';

type PhraseScopeFilter = 'all' | 'workspace' | 'personal';
type SectionFilter = 'current' | 'all';

export function SurveyPhrasePanel({
  accountId,
  sectionKey,
  ricsCode,
  canEdit = true,
  onInsert,
}: {
  accountId: string;
  sectionKey: string;
  ricsCode?: string | null;
  canEdit?: boolean;
  onInsert: (body: string, defaultRating?: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('current');
  const [scope, setScope] = useState<PhraseScopeFilter>('all');
  const [phrases, setPhrases] = useState<SurveyPhrase[]>([]);
  const [selected, setSelected] = useState<SurveyPhrase | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const loadPhrases = (nextQuery = query) => {
    startTransition(async () => {
      try {
        const rows = await listSurveyPhrasesAction({
          accountId,
          ricsCode:
            sectionFilter === 'current' ? (ricsCode ?? undefined) : undefined,
          sectionKey:
            sectionFilter === 'current' && !ricsCode ? sectionKey : undefined,
          query: nextQuery.trim() || undefined,
          scope: scope === 'all' ? undefined : scope,
          allSections: sectionFilter === 'all',
        });
        setPhrases(rows);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  useEffect(() => {
    loadPhrases();
    setSelected(null);
    // Reload when the section or filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit filter deps
  }, [accountId, sectionKey, ricsCode, sectionFilter, scope]);

  const groups = useMemo(() => groupPhrasesBySectionCode(phrases), [phrases]);
  const tokens = useMemo(
    () => (selected ? parsePhraseTokens(selected.body) : []),
    [selected],
  );

  const insertPhrase = (phrase: SurveyPhrase, resolved?: string) => {
    if (!canEdit) return;
    const body = resolved ?? resolvePhraseBody(phrase.body);
    onInsert(body, phrase.defaultRating);
    setSelected(null);
  };

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] lg:w-[18rem]">
      <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <p
          className={`flex items-center gap-1.5 text-sm font-semibold ${workspaceText}`}
        >
          <Quote className="h-3.5 w-3.5" />
          Phrase book
        </p>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          Firm and personal banks. Each phrase inserts as its own note.
        </p>
      </div>

      <div className="space-y-2 px-3 py-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              loadPhrases();
            }
          }}
          placeholder="Search title, text, or F3…"
          className="h-8 text-xs"
        />
        <div className="flex gap-1">
          {(
            [
              ['current', 'Current section'],
              ['all', 'All sections'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={sectionFilter === value ? 'default' : 'outline'}
              className="h-7 flex-1 px-2 text-[11px]"
              onClick={() => setSectionFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(
            [
              ['all', 'Both'],
              ['workspace', 'Firm'],
              ['personal', 'My phrase book'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={scope === value ? 'default' : 'outline'}
              className="h-7 flex-1 px-1.5 text-[10px]"
              onClick={() => setScope(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {pending ? (
          <p className={`text-xs ${workspaceTextMuted}`}>Loading…</p>
        ) : phrases.length === 0 ? (
          <p className={`text-xs ${workspaceTextMuted}`}>
            No phrases yet. Import a GoReport spreadsheet (Title, Text, Path)
            under Settings → Phrase banks.
          </p>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={group.code}>
                <p
                  className={`mb-1 text-[11px] font-semibold tracking-wide uppercase ${workspaceTextMuted}`}
                >
                  {group.code}
                </p>
                <ul className="space-y-1">
                  {group.items.map((phrase) => (
                    <li key={phrase.id}>
                      <button
                        type="button"
                        draggable={canEdit}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            SURVEY_PHRASE_DRAG_MIME,
                            serializePhraseDrag({
                              title: phrase.title,
                              body: resolvePhraseBody(phrase.body),
                              ricsCode: phrase.ricsCode,
                              sectionKey: phrase.sectionKey,
                              defaultRating: phrase.defaultRating,
                            }),
                          );
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--workspace-shell-sidebar-accent)]"
                        onClick={() => {
                          const tokensInBody = parsePhraseTokens(phrase.body);
                          if (
                            tokensInBody.some((token) => token.type !== 'text')
                          ) {
                            setSelected(phrase);
                            setAnswers(
                              tokensInBody
                                .filter((token) => token.type !== 'text')
                                .map((token) =>
                                  token.type === 'choice' &&
                                  token.defaultIndex !== null
                                    ? (token.options[token.defaultIndex] ?? '')
                                    : '',
                                ),
                            );
                            return;
                          }
                          insertPhrase(phrase);
                        }}
                      >
                        <span className={`block font-medium ${workspaceText}`}>
                          {phrase.title}
                        </span>
                        <span
                          className={`block truncate ${workspaceTextMuted}`}
                        >
                          {phrase.bankScope === 'personal'
                            ? 'My phrase book'
                            : 'Firm phrase book'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="mt-3 rounded-lg border border-[color:var(--workspace-shell-border)] p-2">
            <PhraseResolver
              tokens={tokens}
              answers={answers}
              onAnswer={setAnswers}
              onInsert={() =>
                insertPhrase(
                  selected,
                  resolvePhraseBody(selected.body, answers),
                )
              }
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
