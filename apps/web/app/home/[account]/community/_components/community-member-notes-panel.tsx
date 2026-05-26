'use client';

import { useState, useTransition } from 'react';

import { Heart, Lock, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  WorkspaceRichTextEditor,
  WorkspaceRichTextHtml,
} from '~/components/workspace-rich-text';
import { isHtmlContent } from '~/lib/sanitize-community-html';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { createMemberNote, deleteMemberNote } from '../_lib/server/community-schedule.actions';
import type { GroupMemberOption, MemberNoteRow } from '../_lib/community-schedule.types';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

type Props = {
  accountSlug: string;
  accountId: string;
  notes: MemberNoteRow[];
  members: GroupMemberOption[];
};

export function CommunityMemberNotesPanel({
  accountSlug,
  accountId,
  notes,
  members,
}: Props) {
  const [subjectUserId, setSubjectUserId] = useState(members[0]?.userId ?? '');
  const [visibility, setVisibility] = useState<
    'leaders' | 'leaders_and_subject' | 'private'
  >('leaders');
  const [category, setCategory] = useState<'general' | 'prayer_request'>(
    'prayer_request',
  );
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    if (!subjectUserId || !stripped) {
      toast.error('Choose a person and enter a note');
      return;
    }
    startTransition(async () => {
      try {
        await createMemberNote({
          accountId,
          accountSlug,
          subjectUserId,
          visibility,
          category,
          content,
        });
        setContent('');
        toast.success('Note saved');
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  }

  return (
    <section className={panelClass}>
      <div className="border-b border-white/6 px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">
          Member notes & prayer requests
        </h3>
        <p className="mt-1 text-xs text-white/50">
          Pastoral notes per person. Visibility controls who can read them.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 border-b border-white/6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>About</Label>
            <Select value={subjectUserId} onValueChange={setSubjectUserId}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) =>
                setCategory(v as 'general' | 'prayer_request')
              }
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prayer_request">Prayer request</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(v) =>
                setVisibility(v as typeof visibility)
              }
            >
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leaders">Leaders only</SelectItem>
                <SelectItem value="leaders_and_subject">
                  Leaders + this person
                </SelectItem>
                <SelectItem value="private">Private (author + leaders)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Note</Label>
          <WorkspaceRichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Prayer request or pastoral note…"
            minHeight={100}
          />
        </div>
        <Button type="submit" disabled={isPending} className={workspaceBtnPrimaryMd}>
          Add note
        </Button>
      </form>

      {notes.length === 0 ? (
        <p className="px-5 py-6 text-sm text-white/50">No notes you can view yet.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {notes.map((n) => (
            <li key={n.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                <span className="font-medium text-white/80">{n.subjectName}</span>
                {n.category === 'prayer_request' ? (
                  <span className="inline-flex items-center gap-1 text-rose-300/90">
                    <Heart className="h-3 w-3" />
                    Prayer
                  </span>
                ) : null}
                {n.visibility === 'leaders' ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Leaders
                  </span>
                ) : n.visibility === 'private' ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Private
                  </span>
                ) : (
                  <span>Leaders + member</span>
                )}
              </div>
              <div className="mt-2 text-sm text-white/75">
                {isHtmlContent(n.content) ? (
                  <WorkspaceRichTextHtml html={n.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{n.content}</p>
                )}
              </div>
              <p className="mt-1 text-xs text-white/40">
                {n.authorName} ·{' '}
                {new Date(n.createdAt).toLocaleDateString('en-GB')}
              </p>
              {n.canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 text-xs text-rose-400/80"
                  onClick={() => {
                    if (!confirm('Delete this note?')) return;
                    startTransition(async () => {
                      await deleteMemberNote({
                        accountSlug,
                        noteId: n.id,
                      });
                      window.location.reload();
                    });
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
