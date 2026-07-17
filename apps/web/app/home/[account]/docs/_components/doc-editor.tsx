'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';

import { AskBrainLink } from '../../brain/_components/ask-brain-link';
import { saveWorkDocAction } from '../_lib/server/docs-server-actions';

type DocEditorProps = {
  accountId: string;
  accountSlug: string;
  doc: {
    id: string;
    title: string;
    content: string | null;
    docType: string | null;
    kind: string;
    projectName: string | null;
    clientName: string | null;
  };
};

export function DocEditor({ accountId, accountSlug, doc }: DocEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content ?? '');
  const [docType, setDocType] = useState(doc.docType ?? '');

  const onSave = () => {
    startTransition(async () => {
      try {
        await saveWorkDocAction({
          accountId,
          accountSlug,
          docId: doc.id,
          title,
          content,
          docType: docType || null,
        });
        toast.success('Document saved');
        router.refresh();
      } catch {
        toast.error('Could not save document');
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-[var(--workspace-shell-text-muted)] capitalize">
        {doc.kind} document
        {doc.projectName || doc.clientName
          ? ` · ${[doc.projectName, doc.clientName].filter(Boolean).join(' · ')}`
          : ''}
      </p>

      <div className="space-y-2">
        <Label
          htmlFor="doc-title"
          className="text-[var(--workspace-shell-text-muted)]"
        >
          Title
        </Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="doc-type"
          className="text-[var(--workspace-shell-text-muted)]"
        >
          Document type
        </Label>
        <Input
          id="doc-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          placeholder="e.g. proposal, contract"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        />
      </div>

      {doc.kind === 'written' ? (
        <div className="space-y-2">
          <Label
            htmlFor="doc-content"
            className="text-[var(--workspace-shell-text-muted)]"
          >
            Content
          </Label>
          <Textarea
            id="doc-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="Write in Markdown — **bold**, headings, lists…"
            className="min-h-[320px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          />
        </div>
      ) : (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Uploaded files are stored separately; edit the title and type here.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <AskBrainLink
          accountSlug={accountSlug}
          label="Ask about this doc"
          className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
          params={{
            q: `What does the document "${title || 'Untitled document'}" cover?`,
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="border-[color:var(--workspace-shell-border)]"
          onClick={() =>
            router.push(
              pathsConfig.app.accountDocs.replace('[account]', accountSlug),
            )
          }
        >
          Back
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="ozer-gradient-btn"
        >
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
