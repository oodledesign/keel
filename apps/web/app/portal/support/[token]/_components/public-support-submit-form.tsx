'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Paperclip, Plus } from 'lucide-react';

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

import type { SupportAttachmentItem } from '~/components/support/support-attachment-uploader';
import { SupportDualPartyIdentity } from '~/components/support/support-party-identity';
import pathsConfig from '~/config/paths.config';

import { createPublicSupportTicketAction } from '../../_lib/public-support.actions';

type ContactOption = { id: string; name: string; email: string | null };
type ProjectOption = { id: string; name: string };

const OTHER = '__other__';

export function PublicSupportSubmitForm({
  token,
  workspaceName,
  workspaceLogoUrl,
  clientName,
  clientPictureUrl,
  contacts,
  projects,
}: {
  token: string;
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  clientName: string;
  clientPictureUrl?: string | null;
  contacts: ContactOption[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contactId, setContactId] = useState(contacts[0]?.id ?? OTHER);
  const [name, setName] = useState(contacts[0]?.name ?? '');
  const [email, setEmail] = useState(contacts[0]?.email ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<
    'low' | 'medium' | 'high' | 'urgent'
  >('medium');
  const [projectId, setProjectId] = useState<string>('__none__');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const isOther = contactId === OTHER;

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === contactId) ?? null,
    [contactId, contacts],
  );

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - attachments.length)) {
        const body = new FormData();
        body.set('supportToken', token);
        body.set('file', file);
        const response = await fetch('/api/support/upload-attachment', {
          method: 'POST',
          body,
        });
        const json = (await response.json()) as {
          attachment?: SupportAttachmentItem;
          error?: string;
        };
        if (!response.ok || !json.attachment) {
          throw new Error(json.error ?? 'Upload failed');
        }
        setAttachments((current) => [...current, json.attachment!]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    startTransition(async () => {
      try {
        const result = await createPublicSupportTicketAction({
          token,
          title,
          description,
          priority,
          submitterContactId: isOther ? null : contactId,
          submitterName: isOther ? name : selectedContact?.name || name,
          submitterEmail: isOther ? email : selectedContact?.email || email,
          projectId: projectId === '__none__' ? null : projectId,
          recordingUrl: recordingUrl || null,
          externalUrl: externalUrl || null,
          attachments,
        });

        const href = pathsConfig.app.publicSupportTicket.replace(
          '[token]',
          result.publicToken,
        );
        router.push(href);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not submit ticket',
        );
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <SupportDualPartyIdentity
          className="mb-4"
          size="md"
          business={{ name: workspaceName, logoUrl: workspaceLogoUrl }}
          client={{ name: clientName, logoUrl: clientPictureUrl }}
        />
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Support request
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Submit a ticket for {clientName}. You&apos;ll get a private link to
          follow the conversation.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="who">Who is submitting?</Label>
        <Select
          value={contactId}
          onValueChange={(value) => {
            setContactId(value);
            if (value === OTHER) {
              setName('');
              setEmail('');
              return;
            }
            const contact = contacts.find((row) => row.id === value);
            setName(contact?.name ?? '');
            setEmail(contact?.email ?? '');
          }}
        >
          <SelectTrigger id="who">
            <SelectValue placeholder="Select contact" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.name}
                {contact.email ? ` · ${contact.email}` : ''}
              </SelectItem>
            ))}
            <SelectItem value={OTHER}>Someone else…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isOther || !selectedContact?.email ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="title">Subject</Label>
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Short summary of the issue"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Details</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          placeholder="What happened? Steps to reproduce, expected result…"
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) =>
              setPriority(value as 'low' | 'medium' | 'high' | 'urgent')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="No project" />
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
        <Label htmlFor="recording">Recording link (optional)</Label>
        <Input
          id="recording"
          type="url"
          value={recordingUrl}
          onChange={(event) => setRecordingUrl(event.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="external">Other link (optional)</Label>
        <Input
          id="external"
          type="url"
          value={externalUrl}
          onChange={(event) => setExternalUrl(event.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-2">
        <Label>Screenshots / PDFs</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || attachments.length >= 5}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*,application/pdf';
              input.multiple = true;
              input.onchange = () => void uploadFiles(input.files);
              input.click();
            }}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="mr-2 h-4 w-4" />
            )}
            Attach file
          </Button>
          {attachments.map((file) => (
            <a
              key={file.url}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-xs text-zinc-700"
            >
              <Plus className="h-3 w-3 rotate-45" />
              {file.name}
            </a>
          ))}
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={pending || uploading || !title.trim() || !description.trim()}
        onClick={submit}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          'Submit ticket'
        )}
      </Button>
    </div>
  );
}
