'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  MapPin,
} from 'lucide-react';

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

import { RICH_TEXT_LIST_CLASS } from '~/lib/rich-text-html';
import {
  formDescriptionHasHeading,
  formDescriptionToHtml,
} from '~/lib/workspace-forms/form-description';
import { FORM_DRAFT_TTL_DAYS } from '~/lib/workspace-forms/form-draft';
import {
  type WorkspaceFormField,
  publicVisibleFields,
} from '~/lib/workspace-forms/form-fields';
import {
  type PublicFormStep,
  buildPublicFormSteps,
  shouldIncludeWelcomeStep,
  validatePublicFormStep,
} from '~/lib/workspace-forms/form-steps';
import type {
  WorkspaceFormLayout,
  WorkspaceFormPresentation,
} from '~/lib/workspace-forms/form-theme';

const EMPTY_PLACEHOLDER =
  'placeholder:text-neutral-400/70 placeholder:opacity-80';

type Props = {
  token: string;
  accountName: string;
  formName: string;
  description: string | null;
  eventAddress: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  layout: WorkspaceFormLayout;
  presentation?: WorkspaceFormPresentation;
  submitLabel: string;
  successMessage: string;
  fields: WorkspaceFormField[];
  listingId?: string | null;
  propertyId?: string | null;
  embed?: boolean;
  /** Prefills the form email field from ?email= on the public share URL. */
  prefillEmail?: string | null;
  resumeToken?: string | null;
  initialValues?: Record<string, string | boolean>;
  initialStepIndex?: number;
  logoUrl?: string | null;
  accentColor: string;
  primaryColor: string;
  /** Light text for workspace name/title when page bg is dark brand gradient. */
  chromeOnDark?: boolean;
  /** Wrap event info + form in a soft off-white shell. */
  contentShell?: boolean;
};

export function PublicWorkspaceForm({
  token,
  accountName,
  formName,
  description,
  eventAddress,
  eventDate,
  eventTime,
  layout,
  presentation = 'classic',
  submitLabel,
  successMessage,
  fields,
  listingId,
  propertyId,
  embed,
  prefillEmail,
  resumeToken: initialResumeToken,
  initialValues,
  initialStepIndex,
  logoUrl,
  accentColor,
  primaryColor,
  chromeOnDark = false,
  contentShell = false,
}: Props) {
  const visibleFields = useMemo(() => publicVisibleFields(fields), [fields]);
  const eventLayout = layout === 'event' && !embed;
  const stepsMode = presentation === 'steps';
  const hasIntro = Boolean(
    description?.trim() ||
    eventAddress?.trim() ||
    eventDate?.trim() ||
    eventTime?.trim(),
  );
  const includeWelcome = shouldIncludeWelcomeStep({
    presentation,
    layout: eventLayout ? 'event' : 'standard',
    embed,
    hasIntro,
  });
  const steps = useMemo(
    () => buildPublicFormSteps({ fields, includeWelcome }),
    [fields, includeWelcome],
  );
  const [stepIndex, setStepIndex] = useState(() => {
    if (!stepsMode || initialStepIndex == null) return 0;
    return Math.min(
      Math.max(0, initialStepIndex),
      Math.max(steps.length - 1, 0),
    );
  });
  const [stepError, setStepError] = useState<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const currentStep = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];
  const isLastStep = stepIndex >= steps.length - 1;
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const restored = { ...(initialValues ?? {}) };
    const email = prefillEmail?.trim();
    if (!email) return restored;
    const emailField = fields.find(
      (field) => field.type === 'email' || field.key === 'email',
    );
    if (!emailField || restored[emailField.key]) return restored;
    return { ...restored, [emailField.key]: email };
  });
  const [resume, setResume] = useState({
    token: initialResumeToken ?? '',
    url: null as string | null,
    email: null as string | null,
    emailed: false,
    error: null as string | null,
    copied: false,
  });
  const [pending, startTransition] = useTransition();
  const [savingDraft, startDraftTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const descriptionHtml = formDescriptionToHtml(description);

  useLayoutEffect(() => {
    if (!stepsMode) return;
    stepHeadingRef.current?.focus();
  }, [stepIndex, stepsMode]);

  function setField(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    setStepError(null);
  }

  function goBack() {
    setStepError(null);
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (!currentStep) return;
    const invalid = validatePublicFormStep(currentStep, values);
    if (invalid) {
      setStepError(invalid);
      return false;
    }
    setStepError(null);
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
    return true;
  }

  function onFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || !stepsMode) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
    if (!isLastStep) {
      event.preventDefault();
      goNext();
    }
  }

  function rememberResumeInUrl(nextToken: string) {
    if (typeof window === 'undefined' || embed) return;
    const url = new URL(window.location.href);
    url.searchParams.set('resume', nextToken);
    window.history.replaceState({}, '', url);
  }

  function saveDraft() {
    setResume((current) => ({ ...current, error: null, copied: false }));
    startDraftTransition(async () => {
      try {
        const response = await fetch('/api/workspace-forms/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            values,
            stepIndex,
            listingId: listingId || null,
            propertyId: propertyId || null,
            resumeToken: resume.token || undefined,
            embed: Boolean(embed),
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          resumeToken?: string;
          resumeUrl?: string;
          emailed?: boolean;
          email?: string | null;
        } | null;

        if (!response.ok || !payload?.ok || !payload.resumeUrl) {
          throw new Error(payload?.error || 'Could not save your answers.');
        }

        setResume((current) => ({
          ...current,
          token: payload.resumeToken ?? current.token,
          url: payload.resumeUrl ?? current.url,
          emailed: current.emailed || Boolean(payload.emailed),
          email: payload.email ?? current.email,
          error: null,
        }));
        if (payload.resumeToken) {
          rememberResumeInUrl(payload.resumeToken);
        }
      } catch (err) {
        setResume((current) => ({
          ...current,
          error:
            err instanceof Error
              ? err.message
              : 'Could not save your answers. Please try again.',
        }));
      }
    });
  }

  async function copyResumeUrl() {
    if (!resume.url) return;
    try {
      await navigator.clipboard.writeText(resume.url);
      setResume((current) => ({ ...current, copied: true }));
    } catch {
      setResume((current) => ({ ...current, copied: false }));
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stepsMode && currentStep) {
      const invalid = validatePublicFormStep(currentStep, values);
      if (invalid) {
        setStepError(invalid);
        return;
      }
      if (!isLastStep) {
        goNext();
        return;
      }
    }
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
            resumeToken: resume.token || undefined,
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
      <div
        className={cn(
          'my-auto flex w-full flex-col items-center justify-center',
          !embed && 'min-h-[60dvh]',
        )}
        data-test="public-form-thank-you"
        role="status"
      >
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-green-500 text-white"
            aria-hidden
          >
            <Check className="size-8" strokeWidth={2.5} />
          </div>
          <p
            className="font-heading text-xl font-bold"
            style={{ color: primaryColor }}
          >
            Thank you
          </p>
          <p className="mt-2 text-sm text-neutral-600">{successMessage}</p>
        </div>
      </div>
    );
  }

  const intro = (
    <PublicFormIntro
      accountName={accountName}
      formName={formName}
      descriptionHtml={descriptionHtml}
      eventAddress={eventAddress}
      eventDate={eventDate}
      eventTime={eventTime}
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
        className={cn(
          eventLayout &&
            'grid items-start gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]',
          contentShell &&
            'rounded-3xl border border-black/5 bg-[var(--ozer-cream-100,#F2E9DB)] p-5 shadow-sm sm:p-8',
        )}
        data-test={
          eventLayout
            ? 'public-form-event-layout'
            : 'public-form-standard-layout'
        }
        data-presentation={presentation}
        data-content-shell={contentShell ? 'true' : undefined}
      >
        {eventLayout ? (
          <aside className="md:sticky md:top-8">{intro}</aside>
        ) : stepsMode ? null : (
          intro
        )}

        <form
          className={cn(
            'space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm',
            stepsMode && 'min-h-[20rem] sm:min-h-[22rem]',
          )}
          onSubmit={onSubmit}
          onKeyDown={onFormKeyDown}
          data-test="public-workspace-form"
          data-presentation={presentation}
        >
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {stepsMode ? (
            <PublicFormSteps
              steps={steps}
              stepIndex={stepIndex}
              stepError={stepError}
              currentStep={currentStep}
              isLastStep={isLastStep}
              values={values}
              pending={pending}
              accentColor={accentColor}
              submitLabel={submitLabel}
              error={error}
              stepHeadingRef={stepHeadingRef}
              eventLayout={eventLayout}
              intro={intro}
              accountName={accountName}
              formName={formName}
              logoUrl={logoUrl}
              primaryColor={primaryColor}
              onChange={setField}
              onBack={goBack}
              onNext={goNext}
              resume={
                <ResumeLaterControls
                  saving={savingDraft}
                  disabled={pending}
                  resumeUrl={resume.url}
                  emailed={resume.emailed}
                  email={resume.email}
                  error={resume.error}
                  copied={resume.copied}
                  onSave={saveDraft}
                  onCopy={copyResumeUrl}
                />
              }
            />
          ) : (
            <>
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

              {error ? (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={pending}
                className="h-11 w-full rounded-full text-white"
                style={{ backgroundColor: accentColor }}
                data-test="public-form-submit"
              >
                {pending ? 'Sending…' : submitLabel}
              </Button>

              <ResumeLaterControls
                saving={savingDraft}
                disabled={pending}
                resumeUrl={resume.url}
                emailed={resume.emailed}
                email={resume.email}
                error={resume.error}
                copied={resume.copied}
                onSave={saveDraft}
                onCopy={copyResumeUrl}
              />
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function PublicFormSteps({
  steps,
  stepIndex,
  stepError,
  currentStep,
  isLastStep,
  values,
  pending,
  accentColor,
  submitLabel,
  error,
  stepHeadingRef,
  eventLayout,
  intro,
  accountName,
  formName,
  logoUrl,
  primaryColor,
  onChange,
  onBack,
  onNext,
  resume,
}: {
  steps: PublicFormStep[];
  stepIndex: number;
  stepError: string | null;
  currentStep: PublicFormStep | undefined;
  isLastStep: boolean;
  values: Record<string, string | boolean>;
  pending: boolean;
  accentColor: string;
  submitLabel: string;
  error: string | null;
  stepHeadingRef: React.RefObject<HTMLHeadingElement | null>;
  eventLayout: boolean;
  intro: React.ReactNode;
  accountName: string;
  formName: string;
  logoUrl?: string | null;
  primaryColor: string;
  onChange: (key: string, value: string | boolean) => void;
  onBack: () => void;
  onNext: () => void;
  resume: React.ReactNode;
}) {
  const total = Math.max(steps.length, 1);
  const progress = ((stepIndex + 1) / total) * 100;
  const welcome = currentStep?.kind === 'welcome';
  const fieldSteps = steps.filter((step) => step.kind === 'fields');
  const fieldTotal = fieldSteps.length;
  const fieldNumber = steps
    .slice(0, stepIndex + 1)
    .filter((step) => step.kind === 'fields').length;
  const currentFields =
    currentStep?.kind === 'fields' ? currentStep.fields : [];
  const singleField = currentFields.length === 1 ? currentFields[0] : null;

  return (
    <div className="flex flex-col gap-5" data-test="public-form-steps">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
          <span data-test="public-form-step-label">
            {welcome
              ? 'Welcome'
              : fieldTotal > 0
                ? `Step ${fieldNumber} of ${fieldTotal}`
                : 'Form'}
          </span>
          <span data-test="public-form-step-count">
            {stepIndex + 1} / {total}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={stepIndex + 1}
          aria-label="Form progress"
          data-test="public-form-progress"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>

      {welcome ? (
        <div className="space-y-6">
          <h2 ref={stepHeadingRef} tabIndex={-1} className="sr-only">
            Welcome
          </h2>
          {!eventLayout ? (
            intro
          ) : (
            <p className="text-sm text-neutral-600">
              A few questions — use Continue to move through them.
            </p>
          )}
        </div>
      ) : currentFields.length > 0 ? (
        <div className="space-y-3">
          {!eventLayout ? (
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={accountName} className="h-8 w-auto" />
              ) : null}
              <p
                className="font-heading text-sm font-semibold"
                style={{ color: primaryColor }}
              >
                {formName}
              </p>
            </div>
          ) : null}
          <h2 ref={stepHeadingRef} tabIndex={-1} className="sr-only">
            {singleField?.label ?? `Step ${fieldNumber}`}
          </h2>
          <div className="space-y-5">
            {currentFields.map((field) => (
              <PublicField
                key={field.id}
                field={field}
                value={values[field.key]}
                disabled={pending}
                accentColor={accentColor}
                emphasis={Boolean(singleField)}
                onChange={(value) => onChange(field.key, value)}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          This form has no questions yet.
        </p>
      )}

      {stepError ? (
        <p
          role="alert"
          className="text-sm text-red-600"
          data-test="public-form-step-error"
        >
          {stepError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onBack}
            className="rounded-full text-neutral-600"
            data-test="public-form-back"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
        ) : (
          <span />
        )}

        {isLastStep ? (
          <Button
            type="submit"
            disabled={pending}
            className="h-11 min-w-[8.5rem] rounded-full text-white"
            style={{ backgroundColor: accentColor }}
            data-test="public-form-submit"
          >
            {pending ? 'Sending…' : submitLabel}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={onNext}
            className="h-11 min-w-[8.5rem] rounded-full text-white"
            style={{ backgroundColor: accentColor }}
            data-test="public-form-next"
          >
            Continue
          </Button>
        )}
      </div>

      {resume}
    </div>
  );
}

function ResumeLaterControls({
  saving,
  disabled,
  resumeUrl,
  emailed,
  email,
  error,
  copied,
  onSave,
  onCopy,
}: {
  saving: boolean;
  disabled: boolean;
  resumeUrl: string | null;
  emailed: boolean;
  email: string | null;
  error: string | null;
  copied: boolean;
  onSave: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-2 pt-1" data-test="public-form-resume">
      <button
        type="button"
        disabled={saving || disabled}
        onClick={onSave}
        className="text-sm font-medium text-neutral-600 underline-offset-2 hover:underline disabled:opacity-60"
        data-test="public-form-save-later"
      >
        {saving ? 'Saving…' : 'Save & continue later'}
      </button>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {resumeUrl ? (
        <div
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-600"
          data-test="public-form-resume-link"
        >
          {emailed && email ? (
            <p className="mb-2">
              We emailed a resume link to{' '}
              <span className="font-medium text-neutral-800">{email}</span>.
            </p>
          ) : (
            <p className="mb-2">
              Copy this link to come back to your answers. It is not a submitted
              response.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={resumeUrl}
              className="h-9 bg-white text-xs"
              onFocus={(event) => event.currentTarget.select()}
              data-test="public-form-resume-url"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full"
              onClick={onCopy}
              data-test="public-form-copy-resume"
            >
              <Copy className="size-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            This link expires in {FORM_DRAFT_TTL_DAYS} days. Submitting the form
            finishes this draft.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PublicFormIntro({
  accountName,
  formName,
  descriptionHtml,
  eventAddress,
  eventDate,
  eventTime,
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
  eventDate?: string | null;
  eventTime?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  chromeOnDark: boolean;
  align: 'left' | 'center';
  eventLayout: boolean;
}) {
  const muted = chromeOnDark ? 'text-white/70' : 'text-neutral-500';
  const body = chromeOnDark ? 'text-white/80' : 'text-neutral-600';
  const titleColor = chromeOnDark ? '#FFFFFF' : primaryColor;
  const showDescriptionTitle =
    Boolean(descriptionHtml) && !formDescriptionHasHeading(descriptionHtml);

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
        className="font-heading mt-2 text-2xl font-bold md:text-3xl"
        style={{ color: titleColor }}
      >
        {formName}
      </h1>
      <EventMetaList
        eventAddress={eventAddress}
        eventDate={eventDate}
        eventTime={eventTime}
        className={cn('mt-4', body, align === 'center' && 'items-center')}
        align={align}
      />
      {descriptionHtml ? (
        <div className={cn('mt-6', body)}>
          {showDescriptionTitle ? (
            <h2
              className="font-heading mb-2 text-base font-semibold"
              style={{ color: titleColor }}
            >
              About
            </h2>
          ) : null}
          <div
            className={cn(
              'text-sm leading-relaxed',
              '[&_a]:underline',
              RICH_TEXT_LIST_CLASS,
              '[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold',
              '[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
            )}
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        </div>
      ) : null}
    </div>
  );
}

function EventMetaList({
  eventAddress,
  eventDate,
  eventTime,
  className,
  align,
}: {
  eventAddress: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  className?: string;
  align: 'left' | 'center';
}) {
  const items = [
    eventAddress
      ? {
          icon: MapPin,
          label: 'Venue',
          value: eventAddress,
          test: 'event-address',
        }
      : null,
    eventDate
      ? { icon: Calendar, label: 'Date', value: eventDate, test: 'event-date' }
      : null,
    eventTime
      ? { icon: Clock, label: 'Time', value: eventTime, test: 'event-time' }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (items.length === 0) return null;

  return (
    <ul
      className={cn(
        'flex flex-col gap-2 text-sm',
        align === 'center' ? 'items-center' : 'items-stretch',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li
            key={item.test}
            className={cn(
              'flex max-w-full gap-2.5 leading-relaxed',
              'items-start',
              align === 'center' && 'justify-center text-left',
            )}
            data-test={`public-form-${item.test}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0 opacity-80" aria-hidden />
            <span className="whitespace-pre-line">
              <span className="sr-only">{item.label}: </span>
              {item.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FieldHelp({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return (
    <p className="text-sm text-neutral-500" data-test="public-form-field-help">
      {text}
    </p>
  );
}

function FieldOptionalMark({ required }: { required: boolean }) {
  if (required) return null;
  return <span className="ml-1 text-neutral-400">(optional)</span>;
}

function PublicField({
  field,
  value,
  disabled,
  accentColor,
  emphasis = false,
  onChange,
}: {
  field: WorkspaceFormField;
  value: string | boolean | undefined;
  disabled: boolean;
  accentColor: string;
  emphasis?: boolean;
  onChange: (value: string | boolean) => void;
}) {
  const inputId = `field-${field.key}`;
  const textValue = typeof value === 'string' ? value : '';
  const titleClass = emphasis
    ? 'font-heading text-xl font-semibold text-neutral-800 md:text-2xl'
    : 'text-sm font-medium text-neutral-700';

  if (field.type === 'checkbox') {
    return (
      <label
        className={cn(
          'flex items-start gap-3 text-neutral-800',
          emphasis ? 'text-base' : 'text-sm',
        )}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          required={field.required}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1"
        />
        <span className="grid gap-1">
          <span className={emphasis ? 'font-heading font-semibold' : undefined}>
            {field.label}
            <FieldOptionalMark required={field.required} />
          </span>
          <FieldHelp text={field.helpText} />
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
        <legend className={titleClass}>
          {field.label}
          <FieldOptionalMark required={field.required} />
        </legend>
        <FieldHelp text={field.helpText} />
        <div
          role="radiogroup"
          aria-required={field.required}
          aria-label={field.label}
          className={cn(
            'grid gap-2',
            options.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {options.map((option) => {
            const selected = textValue === option;
            const optionId = `${inputId}-${option}`;
            return (
              <label
                key={option}
                htmlFor={optionId}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors',
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
        <legend className={titleClass}>
          {field.label}
          <FieldOptionalMark required={field.required} />
        </legend>
        <FieldHelp text={field.helpText} />
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
      <Label htmlFor={inputId} className={titleClass}>
        {field.label}
        <FieldOptionalMark required={field.required} />
      </Label>
      <FieldHelp text={field.helpText} />
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
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
          File upload is not collected on this form yet. The workspace can
          follow up by email if they need an attachment.
        </p>
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
