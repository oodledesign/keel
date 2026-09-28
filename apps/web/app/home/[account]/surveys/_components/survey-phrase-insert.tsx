'use client';

import { Button } from '@kit/ui/button';

import type { PhraseToken } from '~/lib/building-surveyor/phrase-tokens';

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
