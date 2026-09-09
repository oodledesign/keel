'use client';

import { useId, useState } from 'react';

import { X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';

import {
  MAX_FORM_NOTIFY_EMAILS,
  commitFormNotifyEmails,
} from '~/lib/workspace-forms/form-email';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

type Props = {
  emails: string[];
  onChange: (emails: string[]) => void;
  id?: string;
  max?: number;
};

function errorForCommit(
  result: {
    invalid: string[];
    duplicates: string[];
    overflow: string[];
    added: string[];
  },
  max: number,
): string | null {
  if (result.invalid.length === 1) {
    return 'Enter a valid email address';
  }
  if (result.invalid.length > 1) {
    return 'Some addresses are not valid';
  }
  if (result.overflow.length > 0) {
    return `You can add up to ${max} extra addresses`;
  }
  if (result.duplicates.length > 0 && result.added.length === 0) {
    return result.duplicates.length === 1
      ? 'That address is already added'
      : 'Those addresses are already added';
  }
  return null;
}

export function FormNotifyEmailChips({
  emails,
  onChange,
  id,
  max = MAX_FORM_NOTIFY_EMAILS,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = useId();
  const helpId = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const atLimit = emails.length >= max;

  function commit(raw: string) {
    if (!raw.trim()) {
      setError(null);
      return;
    }

    const result = commitFormNotifyEmails(emails, raw);
    if (result.added.length > 0) {
      onChange(result.emails);
    }

    if (result.invalid.length > 0) {
      setDraft(result.invalid.join(', '));
      setError(errorForCommit(result, max));
      return;
    }

    setDraft('');
    setError(errorForCommit(result, max));
  }

  function remove(email: string) {
    onChange(emails.filter((item) => item !== email));
    setError(null);
  }

  return (
    <div className="grid gap-1.5">
      {emails.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5"
          data-test="form-email-notify-extra-pills"
        >
          {emails.map((email) => (
            <span
              key={email}
              data-test="form-email-notify-extra-pill"
              data-email={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text)]"
            >
              <span className="truncate font-medium">{email}</span>
              <button
                type="button"
                onClick={() => remove(email)}
                className="rounded-full p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
                aria-label={`Remove ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          id={inputId}
          type="text"
          inputMode="email"
          autoComplete="email"
          value={draft}
          disabled={atLimit}
          placeholder={
            atLimit ? `Maximum ${max} addresses` : 'name@example.com'
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${helpId}` : helpId}
          data-test="form-email-notify-extra"
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (!/[,;\n\r]/.test(pasted)) return;
            event.preventDefault();
            commit(`${draft}${pasted}`);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;

            if (
              event.key === 'Enter' ||
              event.key === ',' ||
              event.key === ';'
            ) {
              event.preventDefault();
              commit(draft);
              return;
            }

            if (event.key === 'Backspace' && !draft && emails.length > 0) {
              event.preventDefault();
              const last = emails[emails.length - 1];
              if (last) remove(last);
            }
          }}
          onBlur={() => commit(draft)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={atLimit || !draft.trim()}
          data-test="form-email-notify-extra-add"
          onMouseDown={(event) => {
            // Keep focus on the input so blur does not double-commit.
            event.preventDefault();
          }}
          onClick={() => commit(draft)}
        >
          Add
        </Button>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          data-test="form-email-notify-extra-error"
          className="text-destructive text-xs"
        >
          {error}
        </p>
      ) : null}

      <p id={helpId} className={`text-xs ${workspaceTextMuted}`}>
        Add one address at a time, or paste several (comma, semicolon, or new
        line). These are not form questions.
        {emails.length > 0 ? (
          <span className={`ml-1 ${workspaceText}`}>
            {emails.length}/{max}
          </span>
        ) : null}
      </p>
    </div>
  );
}
