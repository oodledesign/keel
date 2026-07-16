'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  Link2,
  Loader2,
  Plus,
  Send,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { listContacts } from '~/home/[account]/clients/_lib/server/server-actions';
import { formatContactRoleLabel } from '~/lib/clients/contact-roles';

import { getErrorMessage } from '../_lib/error-message';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  INVOICE_SMART_FIELD_PILLS,
  renderSmartFields,
} from '../_lib/invoice-smart-fields';
import { formatPence } from '../_lib/invoice-totals';
import {
  getInvoicePortalLink,
  markInvoiceSentManually,
  sendInvoice,
} from '../_lib/server/server-actions';

type Recipient = {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  source: 'contact' | 'custom';
};

type ClientContactOption = {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  role: string | null;
  is_primary: boolean;
};

type PreviewClient = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  email?: string | null;
};

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function RecipientPill({
  recipient,
  onRemove,
}: {
  recipient: Recipient;
  onRemove: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text)]">
            <span className="truncate font-medium">{recipient.name}</span>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
              aria-label={`Remove ${recipient.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {recipient.email}
          {recipient.role
            ? ` · ${formatContactRoleLabel(recipient.role)}`
            : ''}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TokenPill({
  label,
  token,
  onInsert,
}: {
  label: string;
  token: string;
  onInsert: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onInsert}
            className="rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[color:var(--ozer-accent)] hover:text-[var(--workspace-shell-text)]"
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-xs">
          {token}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InvoiceSendPanel({
  accountId,
  invoiceId,
  clientId,
  invoiceNumber,
  totalPence,
  dueAt,
  currency = 'gbp',
  defaultEmail,
  defaultRecipientName,
  client,
  initialSubject,
  initialBody,
  initialSignature,
  pdfQuery,
  isDraft = false,
  onSent,
  onMarkedSent,
  onClose,
}: {
  accountId: string;
  invoiceId: string;
  clientId: string;
  invoiceNumber: string;
  totalPence: number;
  dueAt?: string | null;
  currency?: string;
  defaultEmail: string;
  defaultRecipientName?: string | null;
  client?: PreviewClient | null;
  initialSubject?: string | null;
  initialBody?: string | null;
  initialSignature?: string | null;
  pdfQuery?: string;
  isDraft?: boolean;
  onSent: () => void;
  onMarkedSent?: () => void;
  onClose: () => void;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>(() => {
    const email = defaultEmail.trim();
    if (!email) return [];
    return [
      {
        id: `default-${email.toLowerCase()}`,
        email,
        name: defaultRecipientName?.trim() || email,
        source: 'contact',
      },
    ];
  });
  const [subject, setSubject] = useState(
    initialSubject ?? DEFAULT_INVOICE_EMAIL_SUBJECT,
  );
  const [body, setBody] = useState(initialBody ?? DEFAULT_INVOICE_EMAIL_BODY);
  const [signature, setSignature] = useState(
    initialSignature ?? DEFAULT_INVOICE_EMAIL_SIGNATURE,
  );
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<
    'send' | 'test' | 'link' | 'pdf' | null
  >(null);
  const [markAsSent, setMarkAsSent] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [contacts, setContacts] = useState<ClientContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const pdfHref = useMemo(() => {
    const base = `/api/invoices/pdf?invoiceId=${encodeURIComponent(invoiceId)}`;
    return pdfQuery ? `${base}&${pdfQuery}` : base;
  }, [invoiceId, pdfQuery]);

  const recipientEmails = useMemo(
    () => recipients.map((r) => r.email.trim()).filter(Boolean),
    [recipients],
  );

  const primaryRecipient = recipients[0] ?? null;

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const result = (await listContacts({ accountId, clientId })) as {
        data?: ClientContactOption[];
      };
      setContacts(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    if (!addOpen) return;
    void loadContacts();
  }, [addOpen, loadContacts]);

  const addRecipient = (next: Recipient) => {
    const email = next.email.trim().toLowerCase();
    if (!emailLooksValid(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setRecipients((prev) => {
      if (prev.some((r) => r.email.toLowerCase() === email)) {
        toast.message('That recipient is already added');
        return prev;
      }
      return [...prev, { ...next, email: next.email.trim(), id: next.id || email }];
    });
  };

  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const loadPortalLink = async () => {
    if (portalUrl) return portalUrl;
    setLoading('link');
    try {
      const result = await getInvoicePortalLink({ accountId, invoiceId });
      const token =
        (result as { token?: string } | null)?.token ??
        (result as { data?: { token?: string } } | null)?.data?.token;
      if (!token) throw new Error('Could not generate link');
      const url = `${window.location.origin}/portal/invoices/${encodeURIComponent(token)}`;
      setPortalUrl(url);
      return url;
    } finally {
      setLoading(null);
    }
  };

  const maybeMarkAsSent = async () => {
    if (!isDraft || !markAsSent) return false;
    await markInvoiceSentManually({
      accountId,
      invoiceId,
      sent_to_email: recipientEmails[0] ?? null,
    });
    onMarkedSent?.();
    return true;
  };

  const triggerPdfDownload = () => {
    const link = document.createElement('a');
    link.href = pdfHref;
    link.download = `invoice-${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    setLoading('link');
    try {
      const marked = await maybeMarkAsSent();
      const url = await loadPortalLink();
      await navigator.clipboard.writeText(url);
      toast.success(
        marked ? 'Link copied and invoice marked as sent' : 'Link copied',
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    setLoading('pdf');
    try {
      const marked = await maybeMarkAsSent();
      triggerPdfDownload();
      toast.success(
        marked ? 'PDF downloaded and invoice marked as sent' : 'PDF downloaded',
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleSend = async (testOnly = false) => {
    if (!testOnly && recipientEmails.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    setLoading(testOnly ? 'test' : 'send');
    try {
      await sendInvoice({
        accountId,
        invoiceId,
        sent_to_email: recipientEmails[0] ?? 'test@example.com',
        sent_to_emails: testOnly ? undefined : recipientEmails,
        email_subject: subject,
        email_body: body,
        email_signature: signature,
        send_test_to_self: testOnly,
      });
      toast.success(testOnly ? 'Test email sent' : 'Invoice sent');
      if (!testOnly) {
        setPreviewOpen(false);
        onSent();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const insertField = (
    field: string,
    target: 'body' | 'subject' | 'signature',
  ) => {
    const setter =
      target === 'body'
        ? setBody
        : target === 'subject'
          ? setSubject
          : setSignature;
    setter(
      (prev) =>
        `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${field}`,
    );
  };

  const previewContact = primaryRecipient
    ? {
        first_name: primaryRecipient.name.split(/\s+/)[0] ?? primaryRecipient.name,
        last_name: primaryRecipient.name.split(/\s+/).slice(1).join(' ') || null,
        full_name: primaryRecipient.name,
        email: primaryRecipient.email,
      }
    : null;

  const previewSubject = renderSmartFields(subject, {
    client,
    contact: previewContact,
    invoice: {
      invoice_number: invoiceNumber,
      total_pence: totalPence,
      due_at: dueAt ?? null,
      currency,
    },
  });
  const previewBody = renderSmartFields(body, {
    client,
    contact: previewContact,
    invoice: {
      invoice_number: invoiceNumber,
      total_pence: totalPence,
      due_at: dueAt ?? null,
      currency,
    },
  });
  const previewSignature = renderSmartFields(signature, {
    client,
    contact: previewContact,
    invoice: {
      invoice_number: invoiceNumber,
      total_pence: totalPence,
      due_at: dueAt ?? null,
      currency,
    },
  });

  const availableContacts = contacts.filter(
    (c) =>
      c.email?.trim() &&
      !recipients.some(
        (r) => r.email.toLowerCase() === c.email!.trim().toLowerCase(),
      ),
  );

  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          Send invoice {invoiceNumber}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to edit invoice
        </Button>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Send email</TabsTrigger>
          <TabsTrigger value="link">Shareable link</TabsTrigger>
          <TabsTrigger value="pdf">Export PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2 py-1.5">
              {recipients.map((recipient) => (
                <RecipientPill
                  key={recipient.id}
                  recipient={recipient}
                  onRemove={() => removeRecipient(recipient.id)}
                />
              ))}
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs text-[var(--workspace-shell-text-muted)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-80 space-y-3 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                >
                  <div>
                    <p className="mb-2 text-xs font-medium text-[var(--workspace-shell-text)]">
                      Client contacts
                    </p>
                    {loadingContacts ? (
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        Loading…
                      </p>
                    ) : availableContacts.length === 0 ? (
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        No more contacts with email on this client.
                      </p>
                    ) : (
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {availableContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-[var(--workspace-shell-panel-hover)]"
                            onClick={() => {
                              addRecipient({
                                id: contact.id,
                                email: contact.email!.trim(),
                                name: contact.full_name,
                                role: contact.role,
                                source: 'contact',
                              });
                              setAddOpen(false);
                            }}
                          >
                            <span className="text-sm text-[var(--workspace-shell-text)]">
                              {contact.full_name}
                            </span>
                            <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                              {contact.email}
                              {contact.role
                                ? ` · ${formatContactRoleLabel(contact.role)}`
                                : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-3">
                    <Label htmlFor="custom-recipient-email" className="text-xs">
                      Or type an email
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="custom-recipient-email"
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const email = customEmail.trim();
                            if (!email) return;
                            addRecipient({
                              id: `custom-${email.toLowerCase()}`,
                              email,
                              name: email,
                              source: 'custom',
                            });
                            setCustomEmail('');
                            setAddOpen(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          const email = customEmail.trim();
                          if (!email) return;
                          addRecipient({
                            id: `custom-${email.toLowerCase()}`,
                            email,
                            name: email,
                            source: 'custom',
                          });
                          setCustomEmail('');
                          setAddOpen(false);
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
              Hover a recipient to see their email. Invoices go to all recipients
              listed here.
            </p>
          </div>

          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <Label>Signature</Label>
            <Textarea
              rows={3}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Insert token into body
              <span className="ml-1 text-[10px]">
                (contact = recipient person · client = CRM record)
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {INVOICE_SMART_FIELD_PILLS.map((field) => (
                <TokenPill
                  key={field.token}
                  label={field.label}
                  token={field.token}
                  onInsert={() => insertField(field.token, 'body')}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-[var(--ozer-accent)] text-[#09111F]"
              disabled={loading != null || recipientEmails.length === 0}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview and send
            </Button>
            <Button
              variant="outline"
              disabled={loading != null}
              onClick={() => void handleSend(true)}
            >
              {loading === 'test' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send yourself a test
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="link" className="mt-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            Share this link with your client to view and pay the invoice.
            Card payments via Stripe may incur a small processing fee.
          </p>
          {isDraft ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="mark-sent-link"
                checked={markAsSent}
                onCheckedChange={(checked) => setMarkAsSent(checked === true)}
              />
              <Label htmlFor="mark-sent-link" className="text-sm font-normal">
                Mark as sent
              </Label>
            </div>
          ) : null}
          <Button
            variant="outline"
            disabled={loading === 'link'}
            onClick={() => void handleCopyLink()}
          >
            {loading === 'link' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Copy shareable link
          </Button>
          {portalUrl ? (
            <div className="space-y-2">
              <Input readOnly value={portalUrl} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(portalUrl);
                  toast.success('Link copied');
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy again
              </Button>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="pdf" className="mt-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            Draft PDFs include the due date, reference, and payment link when
            those fields are enabled in invoice settings.
          </p>
          {isDraft ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="mark-sent-pdf"
                checked={markAsSent}
                onCheckedChange={(checked) => setMarkAsSent(checked === true)}
              />
              <Label htmlFor="mark-sent-pdf" className="text-sm font-normal">
                Mark as sent
              </Label>
            </div>
          ) : null}
          <Button
            variant="outline"
            disabled={loading === 'pdf'}
            onClick={() => void handleDownloadPdf()}
          >
            {loading === 'pdf' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isDraft ? 'Download draft PDF' : 'Download PDF'}
          </Button>
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle>Preview email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              To:{' '}
              {recipients.map((r) => r.name).join(', ') || 'No recipients'}
            </p>
            <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-white p-4 text-[var(--ozer-text-on-light)] shadow-sm">
              <p className="mb-3 text-base font-semibold">{previewSubject}</p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {previewBody}
              </p>
              <div className="my-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <p className="font-medium">Invoice {invoiceNumber}</p>
                <p className="mt-1">Total: {formatPence(totalPence)}</p>
                <p className="mt-1 text-zinc-600">
                  Due date:{' '}
                  {dueAt
                    ? new Date(dueAt).toLocaleDateString('en-GB')
                    : '—'}
                </p>
                <p className="mt-3 text-[var(--ozer-accent)] underline">
                  View and pay invoice
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Paying online by card may incur a small processing fee.
                </p>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-zinc-700">
                {previewSignature}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Back to edit
            </Button>
            <Button
              type="button"
              className={cn('bg-[var(--ozer-accent)] text-[#09111F]')}
              disabled={loading != null || recipientEmails.length === 0}
              onClick={() => void handleSend(false)}
            >
              {loading === 'send' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
