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
import { cn } from '@kit/ui/utils';

import { formDescriptionToHtml } from '~/lib/workspace-forms/form-description';
import {
  type WorkspaceFormField,
  publicVisibleFields,
} from '~/lib/workspace-forms/form-fields';
import type { WorkspaceFormLayout } from '~/lib/workspace-forms/form-theme';

const EMPTY_PLACEHOLDER =
  'placeholder:text-neutral-400/70 placeholder:opacity-80';

type Props = {
  token: string;
  accountName: string;
  formName: string;
  description: string | null;
  eventAddress: string | null;
  layout: WorkspaceFormLayout;
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
  eventAddress,
  layout,
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

  const eventLayout = layout === 'event' && !embed;
  const descriptionHtml = formDescriptionToHtml(description);

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
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
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

  const intro = (
    <PublicFormIntro
      accountName={accountName}
      formName={formName}
      descriptionHtml={descriptionHtml}
      eventAddress={eventAddress}
      logoUrl={logoUrl}
      primaryColor={primaryColor}
      chromeOnDark={chromeOnDark}
      align={eventLayout ? 'left' : 'center'}
      eventLayout={eventLayout}
    />
  );

  return (
    <div
      className={cn(
        'mx-auto w-full',
        embed ? 'max-w-xl' : eventLayout ? 'max-w-5xl' : 'max-w-lg',
      )}
      style={{ ['--form-accent' as string]: accentColor }}
    >
      <div
        className={
          eventLayout
            ? 'grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'
            : undefined
        }
      >
        {eventLayout ? (
          <aside className="lg:sticky lg:top-8">{intro}</aside>
        ) : (
          intro
        )}

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
              accentColor={accentColor}
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
    </div>
  );
}

function PublicFormIntro({
  accountName,
  formName,
  descriptionHtml,
  eventAddress,
  logoUrl,
  primaryColor,
  chromeOnDark,
  align,
  eventLayout,
}: {
  accountName: string;
  formName: string;
  descriptionHtml: string;
  eventAddress: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  chromeOnDark: boolean;
  align: 'left' | 'center';
  eventLayout: boolean;
}) {
  const muted = chromeOnDark ? 'text-white/70' : 'text-neutral-500';
  const body = chromeOnDark ? 'text-white/80' : 'text-neutral-600';

  return (
    <div
      className={cn(
        align === 'center' && 'text-center',
        !eventLayout && 'mb-6',
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={accountName}
          className={cn(
            'mb-4 h-14 w-auto',
            align === 'center' ? 'mx-auto' : 'max-h-16',
          )}
        />
      ) : null}
      <p className={cn('text-xs font-medium tracking-wide uppercase', muted)}>
        {accountName}
      </p>
      <h1
        className="font-heading mt-2 text-2xl font-bold lg:text-3xl"
        style={{ color: chromeOnDark ? '#FFFFFF' : primaryColor }}
      >
        {formName}
      </h1>
      {eventAddress ? (
        <p
          className={cn(
            'mt-3 text-sm leading-relaxed whitespace-pre-line',
            body,
          )}
        >
          {eventAddress}
        </p>
      ) : null}
      {descriptionHtml ? (
        <div
          className={cn(
            'mt-3 text-sm leading-relaxed',
            body,
            '[&_a]:underline',
            '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
            '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
            '[&_p]:my-1',
          )}
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      ) : null}
    </div>
  );
}

function PublicField({
  field,
  value,
  disabled,
  accentColor,
  onChange,
}: {
  field: WorkspaceFormField;
  value: string | boolean | undefined;
  disabled: boolean;
  accentColor: string;
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

  if (field.type === 'yes_no') {
    const options =
      field.options && field.options.length >= 2
        ? field.options.slice(0, 4)
        : ['Yes', 'No'];

    return (
      <fieldset className="space-y-2" data-test={`yes-no-${field.key}`}>
        <legend className="text-sm font-medium text-neutral-700">
          {field.label}
          {field.required ? (
            ''
          ) : (
            <span className="ml-1 text-neutral-400">(optional)</span>
          )}
        </legend>
        <div
          role="radiogroup"
          aria-required={field.required}
          aria-label={field.label}
          className="grid grid-cols-2 gap-3"
        >
          {options.map((option) => {
            const selected = textValue === option;
            const optionId = `${inputId}-${option}`;
            return (
              <label
                key={option}
                htmlFor={optionId}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 px-4 py-3 text-base font-semibold transition-colors',
                  selected
                    ? 'text-white'
                    : 'border-neutral-200 bg-[var(--ozer-cream-50,#FBF6EC)] text-neutral-800 hover:border-neutral-300',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
                style={
                  selected
                    ? {
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                      }
                    : undefined
                }
              >
                <input
                  id={optionId}
                  type="radio"
                  name={field.key}
                  value={option}
                  checked={selected}
                  disabled={disabled}
                  required={field.required}
                  className="sr-only"
                  onChange={() => onChange(option)}
                />
                {option}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (field.type === 'radio') {
    const options = field.options ?? [];
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-neutral-700">
          {field.label}
          {field.required ? (
            ''
          ) : (
            <span className="ml-1 text-neutral-400">(optional)</span>
          )}
        </legend>
        <div role="radiogroup" aria-label={field.label} className="space-y-2">
          {options.map((option) => {
            const optionId = `${inputId}-${option}`;
            return (
              <label
                key={option}
                htmlFor={optionId}
                className="flex items-center gap-2 text-sm text-neutral-800"
              >
                <input
                  id={optionId}
                  type="radio"
                  name={field.key}
                  value={option}
                  checked={textValue === option}
                  disabled={disabled}
                  required={field.required}
                  onChange={() => onChange(option)}
                />
                {option}
              </label>
            );
          })}
        </div>
      </fieldset>
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
          <SelectTrigger id={inputId} className={EMPTY_PLACEHOLDER}>
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
          placeholder={field.placeholder || ' '}
          rows={4}
          className={EMPTY_PLACEHOLDER}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === 'date' ? (
        <Input
          id={inputId}
          type="date"
          required={field.required}
          disabled={disabled}
          value={textValue}
          className={EMPTY_PLACEHOLDER}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === 'file' ? (
        <Input
          id={inputId}
          type="file"
          required={field.required}
          disabled={disabled}
          className={EMPTY_PLACEHOLDER}
          onChange={(event) => {
            const file = event.target.files?.[0];
            onChange(file?.name ?? '');
          }}
        />
      ) : (
        <Input
          id={inputId}
          required={field.required}
          disabled={disabled}
          value={textValue}
          placeholder={field.placeholder || ' '}
          className={EMPTY_PLACEHOLDER}
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
