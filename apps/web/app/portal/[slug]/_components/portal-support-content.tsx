'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Briefcase, LifeBuoy } from 'lucide-react';

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
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { SupportAttachmentUploader } from '~/components/support/support-attachment-uploader';
import type { SupportAttachmentItem } from '~/components/support/support-attachment-uploader';
import { SupportMessageAttachments } from '~/components/support/support-message-attachments';
import { SupportDualPartyIdentity } from '~/components/support/support-party-identity';
import pathsConfig from '~/config/paths.config';

import type { PortalTicketPriority } from '../_lib/schema/portal.schema';
import type {
  PortalTicketDetail,
  PortalTicketMessage,
} from '../_lib/server/client-portal.service';
import {
  addPortalTicketMessage,
  createPortalTicket,
} from '../_lib/server/server-actions';
import {
  PortalTicketPriorityBadge,
  PortalTicketStatusBadge,
  formatPortalDate,
  formatPortalTicketNumber,
} from './portal-badges';

type ProjectOption = { id: string; name: string };

export function PortalSupportDetailContent({
  ticket: initialTicket,
  initialMessages,
  clientOrgId,
  clientSlug,
  accountId,
  accountSlug,
  clientName,
  clientPictureUrl,
  businessName,
  businessLogoUrl,
}: {
  ticket: PortalTicketDetail;
  initialMessages: PortalTicketMessage[];
  clientOrgId: string;
  clientSlug: string;
  accountId: string;
  accountSlug: string;
  clientName?: string | null;
  clientPictureUrl?: string | null;
  businessName?: string | null;
  businessLogoUrl?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ticket, setTicket] = useState(initialTicket);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [externalUrl, setExternalUrl] = useState('');

  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );

  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';
  const needsCredits = ticket.status === 'pending_credits';

  const handleReply = (event: React.FormEvent, reopen = false) => {
    event.preventDefault();
    if (!reply.trim()) {
      toast.error('Message is required');
      return;
    }

    startTransition(async () => {
      try {
        const message = await addPortalTicketMessage({
          clientOrgId,
          ticketId: ticket.id,
          accountId,
          accountSlug,
          message: reply.trim(),
          attachments,
          external_url: externalUrl.trim() || null,
          reopen: reopen || isClosed,
        });
        setMessages((current) => [...current, message]);
        setReply('');
        setAttachments([]);
        setExternalUrl('');
        if (reopen || isClosed) {
          setTicket((current) => ({ ...current, status: 'open' }));
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send message',
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href={listHref}
        className="text-sm text-[var(--ozer-text-on-light-muted)] hover:text-[var(--ozer-text-on-light)]"
      >
        ← Back to services
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-[var(--ozer-text-on-light-muted)]">
            {formatPortalTicketNumber(ticket.ticketNumber)}
          </span>
          <PortalTicketStatusBadge status={ticket.status} />
          <PortalTicketPriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          {ticket.title}
        </h1>
        {(businessName || clientName) && (
          <SupportDualPartyIdentity
            className="mt-3"
            size="sm"
            business={
              businessName
                ? { name: businessName, logoUrl: businessLogoUrl }
                : null
            }
            client={
              clientName
                ? { name: clientName, logoUrl: clientPictureUrl }
                : null
            }
          />
        )}
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          Opened {formatPortalDate(ticket.createdAt)}
        </p>
      </div>

      {needsCredits ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          This request is waiting on credits before work can start.{' '}
          <Link href={creditsHref} className="font-medium underline">
            Top up credits
          </Link>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--ozer-text-on-light)]">
            Conversation
          </h2>
        </div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              No messages yet.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ozer-text-on-light-muted)]">
                  <span className="font-medium text-[var(--ozer-text-on-light-muted)]">
                    {message.authorName?.trim() || 'Support'}
                  </span>
                  <span>{formatPortalDate(message.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-slate-800">
                  {message.message}
                </p>
                <SupportMessageAttachments attachments={message.attachments} />
                {message.externalUrl ? (
                  <a
                    href={message.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs text-[var(--ozer-accent)] underline"
                  >
                    External link
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(event) => handleReply(event)}
          className="space-y-3 border-t border-slate-200 px-4 py-4"
        >
          <Label htmlFor="reply">
            {isClosed ? 'Reopen with a reply' : 'Reply'}
          </Label>
          <Textarea
            id="reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            placeholder="Write your message…"
          />
          <div className="space-y-2">
            <Label htmlFor="portal-reply-link">Link (optional)</Label>
            <Input
              id="portal-reply-link"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="https://"
            />
          </div>
          <SupportAttachmentUploader
            accountId={accountId}
            value={attachments}
            onChange={setAttachments}
          />
          <div className="flex justify-end gap-2">
            {isClosed ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={(event) => handleReply(event, true)}
              >
                Reopen ticket
              </Button>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {isPending
                ? 'Sending…'
                : isClosed
                  ? 'Reopen & send'
                  : 'Send reply'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const priorityOptions: { value: PortalTicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const GENERAL_SUPPORT_ID = '__general_support__';

type RequestIntent = 'service' | 'support';
type WizardStep = 1 | 2 | 3 | 4;

type PortalRequestTypeOption = {
  id: string;
  label: string;
  creditCost: number;
  isBillable: boolean;
  isSupport: boolean;
  categoryGroup: string | null;
};

const STEP_LABELS = ['Type', 'Service', 'Details', 'Confirm'] as const;

function WizardStepHeader({
  step,
  intent,
}: {
  step: WizardStep;
  intent: RequestIntent | null;
}) {
  const labels =
    intent === 'support'
      ? (['Type', 'Topic', 'Details', 'Confirm'] as const)
      : STEP_LABELS;

  return (
    <ol className="flex flex-wrap gap-2">
      {labels.map((label, index) => {
        const n = (index + 1) as WizardStep;
        const active = step === n;
        const done = step > n;
        return (
          <li
            key={label}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
              active
                ? 'bg-[var(--ozer-accent)] text-white'
                : done
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-text-on-light)]'
                  : 'bg-slate-100 text-[var(--ozer-text-on-light-muted)]',
            )}
          >
            <span className="tabular-nums">{n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function IntentRadioCard({
  selected,
  onSelect,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-4 rounded-xl border px-4 py-4 text-left transition-colors',
        selected
          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
      aria-pressed={selected}
    >
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          selected
            ? 'bg-[var(--ozer-accent)] text-white'
            : 'bg-slate-100 text-[var(--ozer-text-on-light-muted)]',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[var(--ozer-text-on-light)]">
          {title}
        </span>
        <span className="mt-1 block text-sm text-[var(--ozer-text-on-light-muted)]">
          {description}
        </span>
      </span>
    </button>
  );
}

function TypeRadioCard({
  selected,
  onSelect,
  title,
  meta,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
        selected
          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
      aria-pressed={selected}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
            selected
              ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)]'
              : 'border-slate-300 bg-white',
          )}
          aria-hidden
        >
          {selected ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ) : null}
        </span>
        <span className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
          {title}
        </span>
      </span>
      <span className="shrink-0 text-xs text-[var(--ozer-text-on-light-muted)]">
        {meta}
      </span>
    </button>
  );
}

export function PortalSupportNewForm({
  clientOrgId,
  accountId,
  accountSlug,
  clientSlug,
  initialBalance = 0,
  initialRequestTypes = [],
  initialProjects = [],
}: {
  clientOrgId: string;
  accountId: string;
  accountSlug: string;
  clientSlug: string;
  initialBalance?: number;
  initialRequestTypes?: Array<{
    id: string;
    label: string;
    creditCost: number;
    isBillable: boolean;
    isSupport?: boolean;
    categoryGroup: string | null;
  }>;
  initialProjects?: ProjectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [intent, setIntent] = useState<RequestIntent | null>(null);
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as PortalTicketPriority,
    project_id: '',
    recording_url: '',
    external_url: '',
  });

  const requestTypes: PortalRequestTypeOption[] = initialRequestTypes.map(
    (row) => ({
      ...row,
      isSupport: Boolean(row.isSupport),
    }),
  );
  const projects = initialProjects;

  const listHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  const serviceTypes = requestTypes.filter((row) => !row.isSupport);
  const supportTypes = requestTypes.filter((row) => row.isSupport);

  const selectedType =
    selectedTypeId === GENERAL_SUPPORT_ID
      ? null
      : (requestTypes.find((row) => row.id === selectedTypeId) ?? null);

  const selectedTypeLabel =
    selectedTypeId === GENERAL_SUPPORT_ID
      ? 'General support'
      : (selectedType?.label ?? null);

  const creditMeta = selectedType
    ? selectedType.isBillable
      ? `${selectedType.creditCost} credit${selectedType.creditCost === 1 ? '' : 's'} when work starts`
      : 'Free'
    : intent === 'support'
      ? 'Free'
      : null;

  function goNextFromIntent() {
    if (!intent) {
      toast.error('Choose Service or Support to continue');
      return;
    }
    setSelectedTypeId('');
    setStep(2);
  }

  function goNextFromType() {
    if (intent === 'service') {
      if (serviceTypes.length === 0) {
        toast.error('No services are available yet');
        return;
      }
      if (!selectedTypeId) {
        toast.error('Select a service to continue');
        return;
      }
    }
    if (intent === 'support') {
      if (supportTypes.length > 0 && !selectedTypeId) {
        toast.error('Select a support topic to continue');
        return;
      }
      if (supportTypes.length === 0) {
        setSelectedTypeId(GENERAL_SUPPORT_ID);
      }
    }
    setStep(3);
  }

  function goNextFromDetails() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setStep(4);
  }

  function handleSubmit() {
    if (!intent) return;
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    const requestTypeId =
      !selectedTypeId || selectedTypeId === GENERAL_SUPPORT_ID
        ? null
        : selectedTypeId;

    if (intent === 'service' && !requestTypeId) {
      toast.error('Select a service to continue');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createPortalTicket({
          clientOrgId,
          accountId,
          accountSlug,
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          project_id: form.project_id || null,
          request_type_id: requestTypeId,
          request_intent: intent,
          recording_url: form.recording_url.trim() || null,
          external_url: form.external_url.trim() || null,
          attachments,
        });

        router.push(
          pathsConfig.app.clientPortalSupportDetail
            .replace('[clientSlug]', clientSlug)
            .replace('[id]', created.id),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create request',
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-[var(--ozer-text-on-light-muted)]">
          Credit balance:{' '}
          <span className="font-semibold text-[var(--ozer-text-on-light)]">
            {initialBalance}
          </span>
        </span>
        <Link
          href={creditsHref}
          className="font-medium text-[var(--ozer-text-on-light)] underline"
        >
          View credits
        </Link>
      </div>

      <WizardStepHeader step={step} intent={intent} />

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
                What do you need?
              </h3>
              <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
                Services draw from your retainer credits. Support is for help
                and questions.
              </p>
            </div>
            <IntentRadioCard
              selected={intent === 'service'}
              onSelect={() => setIntent('service')}
              title="Request a service"
              description="Choose from configured services — credits may apply when work starts."
              icon={<Briefcase className="h-5 w-5" />}
            />
            <IntentRadioCard
              selected={intent === 'support'}
              onSelect={() => setIntent('support')}
              title="Support ticket"
              description="Ask a question or report an issue. Designed for help, not billable work."
              icon={<LifeBuoy className="h-5 w-5" />}
            />
          </div>
        ) : null}

        {step === 2 && intent === 'service' ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
                Choose a service
              </h3>
              <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
                Select the service that best matches your request.
              </p>
            </div>
            {serviceTypes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-[var(--ozer-text-on-light-muted)]">
                No services are configured yet. Contact your agency, or go back
                and open a support ticket instead.
              </p>
            ) : (
              serviceTypes.map((row) => (
                <TypeRadioCard
                  key={row.id}
                  selected={selectedTypeId === row.id}
                  onSelect={() => setSelectedTypeId(row.id)}
                  title={row.label}
                  meta={
                    row.isBillable
                      ? `${row.creditCost} credit${row.creditCost === 1 ? '' : 's'}`
                      : 'Free'
                  }
                />
              ))
            )}
          </div>
        ) : null}

        {step === 2 && intent === 'support' ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
                Support topic
              </h3>
              <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
                Pick a topic so we can route your request.
              </p>
            </div>
            {supportTypes.length === 0 ? (
              <TypeRadioCard
                selected={
                  selectedTypeId === GENERAL_SUPPORT_ID || !selectedTypeId
                }
                onSelect={() => setSelectedTypeId(GENERAL_SUPPORT_ID)}
                title="General support"
                meta="Free"
              />
            ) : (
              supportTypes.map((row) => (
                <TypeRadioCard
                  key={row.id}
                  selected={selectedTypeId === row.id}
                  onSelect={() => setSelectedTypeId(row.id)}
                  title={row.label}
                  meta={
                    row.isBillable
                      ? `${row.creditCost} credit${row.creditCost === 1 ? '' : 's'}`
                      : 'Free'
                  }
                />
              ))
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
                Details
              </h3>
              <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
                Tell us what you need — the clearer the better.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Brief summary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={6}
                placeholder="Describe what you need in detail"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      priority: value as PortalTicketPriority,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project (optional)</Label>
                <Select
                  value={form.project_id || '__none__'}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      project_id: value === '__none__' ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recording_url">Recording URL (optional)</Label>
              <Input
                id="recording_url"
                value={form.recording_url}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recording_url: event.target.value,
                  }))
                }
                placeholder="https://loom.com/…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="external_url">External link (optional)</Label>
              <Input
                id="external_url"
                value={form.external_url}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    external_url: event.target.value,
                  }))
                }
                placeholder="https://"
              />
            </div>

            <SupportAttachmentUploader
              accountId={accountId}
              value={attachments}
              onChange={setAttachments}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
                Confirm request
              </h3>
              <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
                Double-check the details before submitting.
              </p>
            </div>

            <dl className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--ozer-text-on-light-muted)]">
                  Request type
                </dt>
                <dd className="font-medium text-[var(--ozer-text-on-light)]">
                  {intent === 'service' ? 'Service' : 'Support'}
                </dd>
              </div>
              {selectedTypeLabel ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ozer-text-on-light-muted)]">
                    {intent === 'service' ? 'Service' : 'Topic'}
                  </dt>
                  <dd className="text-right font-medium text-[var(--ozer-text-on-light)]">
                    {selectedTypeLabel}
                  </dd>
                </div>
              ) : null}
              {creditMeta ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ozer-text-on-light-muted)]">
                    Credits
                  </dt>
                  <dd className="text-right font-medium text-[var(--ozer-text-on-light)]">
                    {creditMeta}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--ozer-text-on-light-muted)]">
                  Priority
                </dt>
                <dd className="font-medium text-[var(--ozer-text-on-light)] capitalize">
                  {form.priority}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ozer-text-on-light-muted)]">
                  Title
                </dt>
                <dd className="mt-1 font-medium text-[var(--ozer-text-on-light)]">
                  {form.title.trim()}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ozer-text-on-light-muted)]">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
                  {form.description.trim()}
                </dd>
              </div>
              {attachments.length > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--ozer-text-on-light-muted)]">
                    Attachments
                  </dt>
                  <dd className="font-medium text-[var(--ozer-text-on-light)]">
                    {attachments.length}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setStep((current) => (current - 1) as WizardStep)}
          >
            Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" asChild>
            <Link href={listHref}>Cancel</Link>
          </Button>
        )}

        {step === 1 ? (
          <Button type="button" onClick={goNextFromIntent}>
            Continue
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            type="button"
            onClick={goNextFromType}
            disabled={intent === 'service' && serviceTypes.length === 0}
          >
            Continue
          </Button>
        ) : null}
        {step === 3 ? (
          <Button type="button" onClick={goNextFromDetails}>
            Continue
          </Button>
        ) : null}
        {step === 4 ? (
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
