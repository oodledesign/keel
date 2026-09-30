'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Mail, Megaphone, Pause, Play, UserCheck } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  NOT_EMAILED_REASON_LABEL,
  formatCommsDate,
} from '~/lib/commercial/circulation/contact-comms';
import type {
  ContactCommunications,
  ContactConsentRecord,
  ContactHistoryItem,
} from '~/lib/commercial/circulation/contact-communications';

import {
  getClientCommunications,
  setClientCirculationConsent,
} from '../_lib/server/server-actions';
import { CirculationPill, NewsletterPill } from './contact-comms-pills';

type LawfulBasis = 'manual_opt_in' | 'legitimate_interests';

const LAWFUL_BASIS_LABEL: Record<string, string> = {
  website_requirement_form: 'Website requirement form',
  imported_historical: 'Imported from previous system',
  manual_opt_in: 'Opted in with the agent',
  legitimate_interests: 'Legitimate interests',
  other: 'Other',
  website_form: 'Website mailing-list form',
};

const OPT_IN_OPTIONS: Array<{
  value: LawfulBasis;
  label: string;
  help: string;
}> = [
  {
    value: 'manual_opt_in',
    label: 'They asked to receive them',
    help: 'They agreed, in writing or on a call, to get matching-property emails.',
  },
  {
    value: 'legitimate_interests',
    label: 'Legitimate interests',
    help: 'An active search with you, and the emails only cover properties that match it.',
  },
];

const HISTORY_KIND_LABEL: Record<ContactHistoryItem['kind'], string> = {
  circulation_digest: 'Circulation digest',
  circulation_listing: 'Circulation email',
  campaign: 'Campaign',
};

const SKIP_REASON_LABEL: Record<string, string> = {
  missing_email: 'No email address',
  not_subscribed: 'Not subscribed',
  unsubscribed: 'Unsubscribed',
  suppressed: 'Suppressed',
  already_sent: 'Already sent these properties',
  claimed: 'Another send was already in progress',
};

const sectionClass =
  'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4';
const headingClass =
  'text-[11px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase';

function formatStage(stage: string) {
  return stage.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function ConsentDetails({ record }: { record: ContactConsentRecord }) {
  const facts = [
    LAWFUL_BASIS_LABEL[record.lawfulBasis] ?? record.lawfulBasis,
    record.consentedAt ? `since ${formatCommsDate(record.consentedAt)}` : null,
    record.unsubscribedAt
      ? `unsubscribed ${formatCommsDate(record.unsubscribedAt)}`
      : null,
    record.suppressedAt
      ? `suppressed ${formatCommsDate(record.suppressedAt)}${
          record.suppressionReason ? ` (${record.suppressionReason})` : ''
        }`
      : null,
  ].filter(Boolean);
  return (
    <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
      <span className="text-[var(--workspace-shell-text)]">{record.email}</span>
      {facts.length ? ` · ${facts.join(' · ')}` : null}
    </p>
  );
}

function OptInDialog({
  open,
  email,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  email: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (basis: LawfulBasis) => void;
}) {
  const [basis, setBasis] = useState<LawfulBasis | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setBasis(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>Subscribe to circulation</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {email} will get automatic emails about matching properties. Choose
            why you are allowed to email them. The reason and today&apos;s date
            are saved with their consent record.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Lawful basis</legend>
          {OPT_IN_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition',
                basis === option.value
                  ? 'border-[color:var(--ozer-accent)] bg-[var(--workspace-shell-panel-hover)]'
                  : 'border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-panel-hover)]',
              )}
            >
              <input
                type="radio"
                name="lawful-basis"
                value={option.value}
                checked={basis === option.value}
                onChange={() => setBasis(option.value)}
                className="mt-0.5 accent-[var(--ozer-accent)]"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-[var(--workspace-shell-text-muted)]">
                  {option.help}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            disabled={!basis || pending}
            onClick={() => basis && onConfirm(basis)}
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            data-test="contact-circulation-opt-in-confirm"
          >
            Subscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsCard({
  data,
  canEdit,
  pending,
  onPause,
  onResume,
  onOptIn,
}: {
  data: ContactCommunications;
  canEdit: boolean;
  pending: boolean;
  onPause: (email: string) => void;
  onResume: (email: string) => void;
  onOptIn: (email: string) => void;
}) {
  const { summary } = data;
  const primary =
    data.circulation.find((record) => record.email === data.primaryEmail) ??
    null;
  const blocked =
    summary.circulationStatus === 'unsubscribed' ||
    summary.circulationStatus === 'suppressed';

  return (
    <section className={sectionClass} aria-labelledby="comms-permissions">
      <h3 id="comms-permissions" className={headingClass}>
        Permissions
      </h3>

      <div className="mt-3 space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
              <Mail aria-hidden className="h-4 w-4" />
              Circulation
              <CirculationPill status={summary.circulationStatus} />
            </div>
            {canEdit && data.primaryEmail && !blocked ? (
              summary.circulationStatus === 'subscribed' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onPause(data.primaryEmail!)}
                  data-test="contact-circulation-pause"
                >
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                  Pause automatic emails
                </Button>
              ) : summary.circulationStatus === 'paused' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onResume(data.primaryEmail!)}
                  data-test="contact-circulation-resume"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Resume automatic emails
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onOptIn(data.primaryEmail!)}
                  data-test="contact-circulation-opt-in"
                >
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                  Subscribe…
                </Button>
              )
            ) : null}
          </div>
          {data.circulation.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              {data.primaryEmail
                ? `No opt-in recorded for ${data.primaryEmail}. Manual sends only.`
                : 'No email address, so circulation cannot reach them.'}
            </p>
          ) : (
            (primary ? [primary] : data.circulation).map((record) => (
              <ConsentDetails key={record.email} record={record} />
            ))
          )}
          {blocked ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              They opted out or the address is blocked, so it can&apos;t be
              re-subscribed from here.
            </p>
          ) : null}
          {summary.notEmailedReason ? (
            <p className="mt-2 rounded-md bg-amber-100 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              Not in the next circulation:{' '}
              {NOT_EMAILED_REASON_LABEL[summary.notEmailedReason]}
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
            <Megaphone aria-hidden className="h-4 w-4" />
            Newsletter
            <NewsletterPill status={summary.newsletterStatus} />
          </div>
          {data.newsletter.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Not on the mailing list.
            </p>
          ) : (
            data.newsletter.map((record) => (
              <ConsentDetails key={record.email} record={record} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function RequirementsSummary({
  data,
  accountSlug,
}: {
  data: ContactCommunications;
  accountSlug: string;
}) {
  if (data.requirements.length === 0) return null;
  const href = pathsConfig.app.accountRequirements.replace(
    '[account]',
    accountSlug,
  );
  return (
    <section className={sectionClass} aria-labelledby="comms-requirements">
      <h3 id="comms-requirements" className={headingClass}>
        Requirements and matches
      </h3>
      <ul className="mt-3 space-y-2">
        {data.requirements.map((req) => {
          const unsent = req.matchCount - req.sentCount;
          return (
            <li key={req.requirementId}>
              <Link
                href={href}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm transition hover:bg-[var(--workspace-shell-panel-hover)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--workspace-shell-text)]">
                    {req.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {formatStage(req.stage)}
                    {req.recipientEmail
                      ? ` · emails go to ${req.recipientEmail}`
                      : ' · no email address'}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
                  {req.active ? (
                    <>
                      <span className="block text-[var(--workspace-shell-text)]">
                        {req.matchCount} live match
                        {req.matchCount === 1 ? '' : 'es'}
                      </span>
                      <span className="block">
                        {req.sentCount} sent
                        {unsent > 0 ? ` · ${unsent} not sent yet` : ''}
                      </span>
                    </>
                  ) : (
                    'Not active'
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HistoryTimeline({
  items,
  accountSlug,
}: {
  items: ContactHistoryItem[];
  accountSlug: string;
}) {
  const listingBase = pathsConfig.app.accountListingDetail.replace(
    '[account]',
    accountSlug,
  );
  return (
    <section className={sectionClass} aria-labelledby="comms-history">
      <h3 id="comms-history" className={headingClass}>
        Email history
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          Ozer hasn&apos;t emailed this contact yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((item) => {
            const failed = item.status === 'failed';
            const skipped = item.status === 'skipped';
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className="border-l-2 border-[color:var(--workspace-shell-border)] pl-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  <span className="font-medium text-[var(--workspace-shell-text)]">
                    {formatCommsDate(item.at)}
                  </span>
                  <span>{HISTORY_KIND_LABEL[item.kind]}</span>
                  {item.kind !== 'campaign' ? (
                    <span>{item.automatic ? 'Automatic' : 'Manual'}</span>
                  ) : null}
                  {failed || skipped ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px font-semibold',
                        failed
                          ? 'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100'
                          : 'bg-[var(--workspace-control-surface)]',
                      )}
                    >
                      {failed ? 'Failed' : 'Skipped'}
                      {item.reason
                        ? `: ${SKIP_REASON_LABEL[item.reason] ?? item.reason}`
                        : ''}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-[var(--workspace-shell-text)]">
                  {item.subject}
                </p>
                {item.listings.length > 0 ? (
                  <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                    {item.listings.slice(0, 6).map((listing, index) => (
                      <span key={listing.id}>
                        {index > 0 ? ', ' : ''}
                        <Link
                          href={listingBase.replace('[id]', listing.id)}
                          prefetch={false}
                          className="underline-offset-2 hover:text-[var(--workspace-shell-text)] hover:underline"
                        >
                          {listing.name}
                        </Link>
                      </span>
                    ))}
                    {item.listingCount > 6
                      ? ` and ${item.listingCount - 6} more`
                      : ''}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function ClientCommunicationsBlock({
  accountSlug,
  accountId,
  clientId,
  canEdit = false,
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEdit?: boolean;
}) {
  const [data, setData] = useState<ContactCommunications | null>(null);
  const [loading, setLoading] = useState(true);
  const [optInEmail, setOptInEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      setData(await getClientCommunications({ accountId, clientId }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load emails',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateConsent = (
    email: string,
    enabled: boolean,
    lawfulBasis?: LawfulBasis,
    successMessage = 'Saved',
  ) => {
    startTransition(async () => {
      try {
        await setClientCirculationConsent({
          accountId,
          clientId,
          email,
          enabled,
          lawfulBasis,
        });
        toast.success(successMessage);
        setOptInEmail(null);
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update',
        );
      }
    });
  };

  if (loading) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading…
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Emails could not be loaded.
      </p>
    );
  }

  return (
    <div className="space-y-4" data-test="client-communications">
      <PermissionsCard
        data={data}
        canEdit={canEdit}
        pending={pending}
        onPause={(email) =>
          updateConsent(email, false, undefined, 'Automatic emails paused')
        }
        onResume={(email) =>
          updateConsent(email, true, undefined, 'Automatic emails resumed')
        }
        onOptIn={setOptInEmail}
      />
      <RequirementsSummary data={data} accountSlug={accountSlug} />
      <HistoryTimeline items={data.history} accountSlug={accountSlug} />
      <OptInDialog
        open={optInEmail !== null}
        email={optInEmail ?? ''}
        pending={pending}
        onOpenChange={(open) => !open && setOptInEmail(null)}
        onConfirm={(basis) =>
          optInEmail &&
          updateConsent(optInEmail, true, basis, 'Subscribed to circulation')
        }
      />
    </div>
  );
}
