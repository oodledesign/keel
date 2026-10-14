'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Download, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBorder,
  workspaceFilterActive,
  workspaceInfoBadge,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  eraseIgContact,
  exportIgContact,
} from '../_lib/server/instagram-contacts-actions';

export type IgContactListItem = {
  id: string;
  username: string | null;
  displayName: string | null;
  tags: string[];
  customFields: Record<string, string>;
  lastInboundAt: string | null;
  optedOut: boolean;
  handedOff: boolean;
  isFollower: boolean | null;
  linkedClientId: string | null;
};

const ALL = '__all';

const STATUS_OPTIONS = [
  { value: ALL, label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'crm', label: 'In CRM' },
  { value: 'handed_off', label: 'With your team' },
  { value: 'opted_out', label: 'Opted out' },
];

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InstagramContactsList(props: {
  accountId: string;
  accountSlug: string;
  contacts: IgContactListItem[];
  tagOptions: string[];
  fieldOptions: string[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [toErase, setToErase] = useState<IgContactListItem | null>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };

  const label = (c: IgContactListItem) =>
    c.username ? `@${c.username}` : (c.displayName ?? 'Instagram user');

  const onExport = (contact: IgContactListItem) =>
    startTransition(async () => {
      try {
        const data = await exportIgContact({
          accountId: props.accountId,
          contactId: contact.id,
        });
        downloadJson(
          `instagram-contact-${contact.username ?? contact.id}.json`,
          data,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Export failed');
      }
    });

  const onErase = () => {
    const contact = toErase;
    if (!contact) return;
    startTransition(async () => {
      try {
        await eraseIgContact({
          accountId: props.accountId,
          contactId: contact.id,
        });
        toast.success(`${label(contact)} erased`);
        setToErase(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erase failed');
      }
    });
  };

  return (
    <div className="mx-4 space-y-4 lg:mx-0">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="min-w-48 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', query.trim() || null);
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name"
            aria-label="Search contacts"
          />
        </form>
        <Select
          value={searchParams.get('status') ?? ALL}
          onValueChange={(v) => setParam('status', v)}
        >
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={workspaceSelectContentClass}>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className={workspaceSelectItemClass}
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={searchParams.get('tag') ?? ALL}
          onValueChange={(v) => setParam('tag', v)}
          disabled={props.tagOptions.length === 0}
        >
          <SelectTrigger className="w-40" aria-label="Tag">
            <SelectValue placeholder="Any tag" />
          </SelectTrigger>
          <SelectContent className={workspaceSelectContentClass}>
            <SelectItem value={ALL} className={workspaceSelectItemClass}>
              Any tag
            </SelectItem>
            {props.tagOptions.map((tag) => (
              <SelectItem
                key={tag}
                value={tag}
                className={workspaceSelectItemClass}
              >
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={searchParams.get('field') ?? ALL}
          onValueChange={(v) => setParam('field', v)}
          disabled={props.fieldOptions.length === 0}
        >
          <SelectTrigger className="w-44" aria-label="Has field">
            <SelectValue placeholder="Any field" />
          </SelectTrigger>
          <SelectContent className={workspaceSelectContentClass}>
            <SelectItem value={ALL} className={workspaceSelectItemClass}>
              Any field
            </SelectItem>
            {props.fieldOptions.map((field) => (
              <SelectItem
                key={field}
                value={field}
                className={workspaceSelectItemClass}
              >
                Has {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className={`text-xs ${workspaceTextMuted}`}>
        {props.total} {props.total === 1 ? 'contact' : 'contacts'}
        {props.total > props.contacts.length
          ? ` · showing the ${props.contacts.length} most recent`
          : ''}
      </p>

      {props.contacts.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No contacts match. People appear here once they comment on a matching
          post or message you.
        </p>
      ) : (
        <ul className={`divide-y ${workspaceBorder} ${workspacePanelCard}`}>
          {props.contacts.map((contact) => (
            <li
              key={contact.id}
              className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${workspaceBorder}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-medium ${workspaceText}`}>
                    {label(contact)}
                  </span>
                  {contact.username && contact.displayName ? (
                    <span className={`text-xs ${workspaceTextMuted}`}>
                      {contact.displayName}
                    </span>
                  ) : null}
                  {contact.optedOut ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${workspaceInfoBadge}`}
                    >
                      Opted out
                    </span>
                  ) : null}
                  {contact.handedOff ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${workspaceFilterActive}`}
                    >
                      With your team
                    </span>
                  ) : null}
                  {contact.isFollower ? (
                    <span className={`text-xs ${workspaceTextMuted}`}>
                      Follower
                    </span>
                  ) : null}
                  {contact.linkedClientId ? (
                    <Link
                      href={pathsConfig.app.accountClientDetail
                        .replace('[account]', props.accountSlug)
                        .replace('[clientId]', contact.linkedClientId)}
                      className="text-xs text-[var(--workspace-shell-accent-text)] hover:underline"
                    >
                      View in CRM
                    </Link>
                  ) : null}
                </div>
                {contact.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setParam('tag', tag)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${workspaceBorder} ${workspaceTextMuted}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
                {Object.keys(contact.customFields).length ? (
                  <dl
                    className={`flex flex-wrap gap-x-4 gap-y-0.5 text-xs ${workspaceTextMuted}`}
                  >
                    {Object.entries(contact.customFields).map(
                      ([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <dt>{key}:</dt>
                          <dd className={`max-w-56 truncate ${workspaceText}`}>
                            {value}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${workspaceTextMuted}`}>
                  Last message {formatWhen(contact.lastInboundAt)}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Export ${label(contact)}`}
                  title="Export data (JSON)"
                  onClick={() => onExport(contact)}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Erase ${label(contact)}`}
                  title="Erase contact"
                  onClick={() => setToErase(contact)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={toErase !== null}
        onOpenChange={(open) => !open && setToErase(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Erase {toErase ? label(toErase) : 'contact'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes their messages, automation history,
              collected details and consent records, and removes their name and
              text from your comment log. Your analytics totals are kept without
              any personal data. A linked CRM client is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                onErase();
              }}
            >
              {pending ? 'Erasing…' : 'Erase'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
