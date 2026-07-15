'use client';

import { useMemo, useState, useTransition } from 'react';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  MessageSquareWarning,
  Monitor,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { SIGNATURE_CHANGE_REQUEST_FIELDS } from '~/lib/signatures/change-request-fields';
import {
  OUTLOOK_INSTALL_STEPS,
  type SignatureInstallStep,
} from '~/lib/signatures/install-instructions';

import { submitPublicSignatureChangeRequestAction } from '../../_lib/server/public-signature-actions';

const OUTLOOK_PATHS = [
  {
    title: 'Outlook desktop (classic)',
    steps: ['File', 'Options', 'Mail', 'Signatures…'],
  },
  {
    title: 'New Outlook / Outlook on the web',
    steps: ['Settings (gear)', 'Accounts', 'Signatures'],
  },
] as const;

export function SignatureInstallSteps({
  steps = OUTLOOK_INSTALL_STEPS,
  signatureHtml,
  fromName,
  token,
  canRequestChanges,
}: {
  steps?: SignatureInstallStep[];
  signatureHtml: string;
  fromName: string;
  token: string;
  canRequestChanges: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(['full_name']);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  const step = steps[index] ?? steps[0]!;
  const total = steps.length;
  const stepId = step.id;

  const downloadDocument = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(fromName)} email signature</title>
</head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;">
${signatureHtml}
</body>
</html>`;
  }, [fromName, signatureHtml]);

  const downloadSignature = () => {
    const blob = new Blob([downloadDocument], {
      type: 'text/html;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const slug = (fromName || 'signature')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    anchor.href = url;
    anchor.download = `${slug || 'signature'}-email-signature.htm`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(signatureHtml);
      setCopied(true);
      toast.success('HTML copied');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy HTML');
    }
  };

  const toggleField = (key: string, checked: boolean) => {
    setSelectedFields((prev) => {
      if (checked) return [...new Set([...prev, key])];
      return prev.filter((item) => item !== key);
    });
  };

  const submitRequest = () => {
    startTransition(async () => {
      try {
        await submitPublicSignatureChangeRequestAction({
          token,
          message,
          fieldKeys: selectedFields,
          requesterName: fromName,
        });
        setSubmitted(true);
        toast.success('Change request sent to your team');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send request',
        );
      }
    });
  };

  return (
    <section
      className="rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-white p-5 shadow-[0_1px_2px_rgba(42,23,32,0.05),0_4px_14px_rgba(42,23,32,0.05)] sm:p-6"
      aria-roledescription="carousel"
      aria-label="How to install your signature in Outlook"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-[color-mix(in_srgb,var(--ozer-plum-900)_55%,transparent)] uppercase">
          Install in Outlook
        </p>
        <p className="text-xs text-[color-mix(in_srgb,var(--ozer-plum-900)_55%,transparent)] tabular-nums">
          Step {index + 1} of {total}
        </p>
      </div>

      <div className="mt-4 min-h-[220px] space-y-4">
        <div>
          <p className="font-[family-name:var(--ozer-font-display)] text-xl font-bold tracking-tight text-[var(--ozer-plum-900)]">
            {step.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ozer-plum-900)]/80">
            {step.body}
          </p>
        </div>

        {stepId === 'open' && canRequestChanges ? (
          <div className="space-y-3 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] p-4">
            <div className="flex items-start gap-2">
              <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                  Something look wrong?
                </p>
                <p className="mt-1 text-sm text-[var(--ozer-plum-900)]/75">
                  Request a change and your team will see it in Signatures.
                </p>
              </div>
            </div>

            {submitted ? (
              <p className="text-sm font-medium text-[var(--ozer-info)]">
                Request sent — your admin can update the details from the
                Requests tab.
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SIGNATURE_CHANGE_REQUEST_FIELDS.map((field) => {
                    const checked = selectedFields.includes(field.key);
                    return (
                      <label
                        key={field.key}
                        className="flex items-center gap-2 rounded-lg border border-[color:var(--ozer-border-on-light)] bg-white px-3 py-2 text-sm text-[var(--ozer-plum-900)]"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleField(field.key, value === true)
                          }
                        />
                        {field.label}
                      </label>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="change-request-message">
                    What should change?
                  </Label>
                  <Textarea
                    id="change-request-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="e.g. Job title should be Senior Quantity Surveyor"
                    rows={3}
                    className="bg-white text-[var(--ozer-plum-900)]"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                  disabled={
                    pending ||
                    !selectedFields.length ||
                    message.trim().length < 3
                  }
                  onClick={submitRequest}
                >
                  {pending ? 'Sending…' : 'Request change'}
                </Button>
              </>
            )}
          </div>
        ) : null}

        {stepId === 'download' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                onClick={downloadSignature}
                data-test="signature-download-html"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download .htm
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-plum-900)]"
                onClick={() => void copyHtml()}
                data-test="signature-copy-html"
              >
                {copied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy HTML'}
              </Button>
            </div>
            <pre className="max-h-48 overflow-auto rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] p-3 text-[11px] leading-relaxed break-all whitespace-pre-wrap text-[var(--ozer-plum-900)]/85">
              {signatureHtml}
            </pre>
          </div>
        ) : null}

        {stepId === 'outlook' ? (
          <div className="grid gap-3">
            {OUTLOOK_PATHS.map((path) => (
              <div
                key={path.title}
                className="rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-[var(--ozer-accent)]" />
                  <p className="text-sm font-semibold text-[var(--ozer-plum-900)]">
                    {path.title}
                  </p>
                </div>
                <ol className="flex flex-wrap items-center gap-1.5">
                  {path.steps.map((label, stepIndex) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className="rounded-md border border-[color:var(--ozer-border-on-light)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ozer-plum-900)] shadow-sm">
                        {label}
                      </span>
                      {stepIndex < path.steps.length - 1 ? (
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--ozer-plum-900)]/40" />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-plum-900)]"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-1.5" aria-hidden>
          {steps.map((_, stepIndex) => (
            <button
              key={stepIndex}
              type="button"
              className={cn(
                'h-1.5 rounded-full transition-all',
                stepIndex === index
                  ? 'w-5 bg-[var(--ozer-accent)]'
                  : 'w-1.5 bg-[color-mix(in_srgb,var(--ozer-plum-900)_18%,transparent)]',
              )}
              onClick={() => setIndex(stepIndex)}
              aria-label={`Go to step ${stepIndex + 1}`}
            />
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          disabled={index >= total - 1}
          onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
