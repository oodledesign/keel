'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';

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
      <p className="text-sm capitalize text-zinc-400">
        {doc.kind} document
        {doc.projectName || doc.clientName
          ? ` · ${[doc.projectName, doc.clientName].filter(Boolean).join(' · ')}`
          : ''}
      </p>

      <div className="space-y-2">
        <Label htmlFor="doc-title" className="text-zinc-300">
          Title
        </Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-type" className="text-zinc-300">
          Document type
        </Label>
        <Input
          id="doc-type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          placeholder="e.g. proposal, contract"
          className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
        />
      </div>

      {doc.kind === 'written' ? (
        <div className="space-y-2">
          <Label htmlFor="doc-content" className="text-zinc-300">
            Content
          </Label>
          <Textarea
            id="doc-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="min-h-[320px] border-white/10 bg-[var(--workspace-shell-panel)] text-white"
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-400">
          Uploaded files are stored separately; edit the title and type here.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-white/10"
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
          className="keel-gradient-btn"
        >
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
