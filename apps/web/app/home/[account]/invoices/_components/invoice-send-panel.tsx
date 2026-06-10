'use client';

import { useState } from 'react';

import { Copy, Download, Link2, Loader2, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
} from '../_lib/invoice-smart-fields';
import { formatPence } from '../_lib/invoice-totals';
import { getErrorMessage } from '../_lib/error-message';
import { getInvoicePortalLink, sendInvoice } from '../_lib/server/server-actions';

const SMART_FIELDS = [
  '{{client.firstName}}',
  '{{invoice.number}}',
  '{{invoice.total}}',
  '{{invoice.dueDate}}',
  '{{your.firstName}}',
];

export function InvoiceSendPanel({
  accountId,
  invoiceId,
  invoiceNumber,
  totalPence,
  defaultEmail,
  initialSubject,
  initialBody,
  initialSignature,
  onSent,
  onClose,
}: {
  accountId: string;
  invoiceId: string;
  invoiceNumber: string;
  totalPence: number;
  defaultEmail: string;
  initialSubject?: string | null;
  initialBody?: string | null;
  initialSignature?: string | null;
  onSent: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState(initialSubject ?? DEFAULT_INVOICE_EMAIL_SUBJECT);
  const [body, setBody] = useState(initialBody ?? DEFAULT_INVOICE_EMAIL_BODY);
  const [signature, setSignature] = useState(initialSignature ?? DEFAULT_INVOICE_EMAIL_SIGNATURE);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<'send' | 'test' | 'link' | null>(null);

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

  const handleSend = async (testOnly = false) => {
    if (!email.trim() && !testOnly) {
      toast.error('Recipient email is required');
      return;
    }
    setLoading(testOnly ? 'test' : 'send');
    try {
      await sendInvoice({
        accountId,
        invoiceId,
        sent_to_email: email.trim() || 'test@example.com',
        email_subject: subject,
        email_body: body,
        email_signature: signature,
        send_test_to_self: testOnly,
      });
      toast.success(testOnly ? 'Test email sent' : 'Invoice sent');
      if (!testOnly) onSent();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const insertField = (field: string, target: 'body' | 'subject' | 'signature') => {
    const setter = target === 'body' ? setBody : target === 'subject' ? setSubject : setSignature;
    setter((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${field}`);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Send invoice {invoiceNumber}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Send email</TabsTrigger>
          <TabsTrigger value="link">Shareable link</TabsTrigger>
          <TabsTrigger value="pdf">Export PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 space-y-4">
          <div>
            <Label>To</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <Label>Signature</Label>
            <Textarea rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {SMART_FIELDS.map((field) => (
              <Button key={field} type="button" size="sm" variant="outline" onClick={() => insertField(field, 'body')}>
                {field}
              </Button>
            ))}
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-sm">
            <p className="font-medium">Preview summary</p>
            <p className="mt-2 text-muted-foreground">
              Invoice {invoiceNumber} · {formatPence(totalPence)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-[var(--keel-teal)] text-[#09111F]"
              disabled={loading != null}
              onClick={() => void handleSend(false)}
            >
              {loading === 'send' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send invoice
            </Button>
            <Button variant="outline" disabled={loading != null} onClick={() => void handleSend(true)}>
              Send yourself a test
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="link" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this link with your client to view and pay the invoice.
          </p>
          <Button
            variant="outline"
            disabled={loading === 'link'}
            onClick={async () => {
              const url = await loadPortalLink();
              await navigator.clipboard.writeText(url);
              toast.success('Link copied');
            }}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Copy shareable link
          </Button>
          {portalUrl ? <Input readOnly value={portalUrl} /> : null}
        </TabsContent>

        <TabsContent value="pdf" className="mt-4">
          <Button asChild variant="outline">
            <a href={`/api/invoices/pdf?invoiceId=${invoiceId}`} download>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
