'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import {
  type WorkspaceFormField,
  publicVisibleFields,
} from '~/lib/workspace-forms/form-fields';

type Props = {
  token: string;
  accountName: string;
  formName: string;
  description: string | null;
  submitLabel: string;
  successMessage: string;
  fields: WorkspaceFormField[];
  listingId?: string | null;
  propertyId?: string | null;
  embed?: boolean;
  /** Prefills the form email field from ?email= on the public share URL. */
  prefillEmail?: string | null;
  logoUrl?: string | null;
  accentColor: string;
  primaryColor: string;
  /** Light text for workspace name/title when page bg is dark brand gradient. */
  chromeOnDark?: boolean;
};

export function PublicWorkspaceForm({
  token,
  accountName,
  formName,
  description,
  submitLabel,
  successMessage,
  fields,
  listingId,
  propertyId,
  embed,
  prefillEmail,
  logoUrl,
  accentColor,
  primaryColor,
  chromeOnDark = false,
}: Props) {
  const visibleFields = useMemo(() => publicVisibleFields(fields), [fields]);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const email = prefillEmail?.trim();
    if (!email) return {};
    const emailField = fields.find(
      (field) => field.type === 'email' || field.key === 'email',
    );
    if (!emailField) return {};
    return { [emailField.key]: email };
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function setField(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const honeypot = String(
      new FormData(event.currentTarget).get('website') ?? '',
    );
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/workspace-forms/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            values,
            listingId: listingId || null,
            propertyId: propertyId || null,
            website: honeypot,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Could not send your enquiry.');
        }

        setSent(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.',
        );
      }
    });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
        <p
          className="font-heading text-xl font-bold"
          style={{ color: primaryColor }}
        >
          Thank you
        </p>
        <p className="mt-2 text-sm text-neutral-600">{successMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto w-full ${embed ? 'max-w-xl' : 'max-w-lg'}`}
      style={{ ['--form-accent' as string]: accentColor }}
    >
      <div className="mb-6 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={accountName}
            className="mx-auto mb-4 h-12 w-auto"
          />
        ) : null}
        <p
          className={`text-xs font-medium tracking-wide uppercase ${
            chromeOnDark ? 'text-white/70' : 'text-neutral-500'
          }`}
        >
          {accountName}
        </p>
        <h1
          className="font-heading mt-2 text-2xl font-bold"
          style={{ color: chromeOnDark ? '#FFFFFF' : primaryColor }}
        >
          {formName}
        </h1>
        {description ? (
          <p
            className={`mt-2 text-sm ${
              chromeOnDark ? 'text-white/80' : 'text-neutral-600'
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>

      <form
        className="space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
        onSubmit={onSubmit}
        data-test="public-workspace-form"
      >
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {visibleFields.map((field) => (
          <PublicField
            key={field.id}
            field={field}
            value={values[field.key]}
            disabled={pending}
            onChange={(value) => setField(field.key, value)}
          />
        ))}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-full text-white"
          style={{ backgroundColor: accentColor }}
          data-test="public-form-submit"
        >
          {pending ? 'Sending…' : submitLabel}
        </Button>
      </form>
    </div>
  );
}

function PublicField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: WorkspaceFormField;
  value: string | boolean | undefined;
  disabled: boolean;
  onChange: (value: string | boolean) => void;
}) {
  const inputId = `field-${field.key}`;
  const textValue = typeof value === 'string' ? value : '';

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-3 text-sm text-neutral-800">
        <input
          id={inputId}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          required={field.required}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1"
        />
        <span>
          {field.label}
          {field.required ? '' : ' (optional)'}
        </span>
      </label>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-neutral-700">
        {field.label}
        {field.required ? (
          ''
        ) : (
          <span className="ml-1 text-neutral-400">(optional)</span>
        )}
      </Label>
      {field.type === 'select' ? (
        <Select value={textValue} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={inputId}>
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'message' || field.type === 'textarea' ? (
        <Textarea
          id={inputId}
          required={field.required}
          disabled={disabled}
          value={textValue}
          placeholder={field.placeholder}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={inputId}
          required={field.required}
          disabled={disabled}
          value={textValue}
          placeholder={field.placeholder}
          type={
            field.type === 'email'
              ? 'email'
              : field.type === 'phone'
                ? 'tel'
                : 'text'
          }
          autoComplete={
            field.type === 'name'
              ? 'name'
              : field.type === 'email'
                ? 'email'
                : field.type === 'phone'
                  ? 'tel'
                  : 'off'
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
