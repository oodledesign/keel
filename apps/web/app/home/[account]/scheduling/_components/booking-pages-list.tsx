'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { publicBookUrl } from '../_lib/public-book-url';
import {
  checkBookingPageSlugAction,
  createBookingPageAction,
  deleteBookingPageAction,
  toggleBookingPageActiveAction,
} from '../_lib/server/scheduling-actions';
import type { BookingPageRow } from '../_lib/server/scheduling.service';

const TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Dublin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  pages: BookingPageRow[];
};

export function BookingPagesList({
  accountId,
  accountSlug,
  canEdit,
  pages: initialPages,
}: Props) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('Europe/London');
  const [brandColour, setBrandColour] = useState('#FF5C34');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'ok' | 'taken'>('idle');

  const pageHref = useMemo(
    () =>
      pathsConfig.app.accountSchedulingPage.replace('[account]', accountSlug),
    [accountSlug],
  );

  function resetForm() {
    setTitle('');
    setSlug('');
    setDescription('');
    setTimezone('Europe/London');
    setBrandColour('#FF5C34');
    setSlugStatus('idle');
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slug || slug === slugify(title)) {
      setSlug(slugify(value));
      setSlugStatus('idle');
    }
  }

  function checkSlug(nextSlug: string) {
    if (nextSlug.length < 2) {
      setSlugStatus('idle');
      return;
    }
    startTransition(async () => {
      try {
        const result = await checkBookingPageSlugAction({
          accountId,
          slug: nextSlug,
        });
        setSlugStatus(result.available ? 'ok' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    });
  }

  function createPage() {
    startTransition(async () => {
      try {
        const page = await createBookingPageAction({
          accountId,
          accountSlug,
          title,
          slug,
          description: description || null,
          timezone,
          brandColour,
          isActive: true,
        });
        setPages((current) => [page, ...current]);
        setOpen(false);
        resetForm();
        toast.success('Booking page created');
        router.push(pageHref.replace('[pageId]', page.id));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create page',
        );
      }
    });
  }

  function toggleActive(page: BookingPageRow, isActive: boolean) {
    setPages((current) =>
      current.map((item) =>
        item.id === page.id ? { ...item, isActive } : item,
      ),
    );
    startTransition(async () => {
      try {
        await toggleBookingPageActiveAction({
          accountId,
          accountSlug,
          pageId: page.id,
          isActive,
        });
      } catch (error) {
        setPages((current) =>
          current.map((item) =>
            item.id === page.id ? { ...item, isActive: page.isActive } : item,
          ),
        );
        toast.error(
          error instanceof Error ? error.message : 'Could not update page',
        );
      }
    });
  }

  function removePage(page: BookingPageRow) {
    if (!window.confirm(`Delete “${page.title}”? This cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteBookingPageAction({
          accountId,
          accountSlug,
          pageId: page.id,
        });
        setPages((current) => current.filter((item) => item.id !== page.id));
        toast.success('Booking page deleted');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete page',
        );
      }
    });
  }

  async function copyLink(page: BookingPageRow) {
    const url = publicBookUrl(page.slug);
    await navigator.clipboard.writeText(url);
    setCopiedId(page.id);
    toast.success('Link copied');
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Booking pages</h2>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Share a public link so clients can book time with your team.
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New booking page
          </Button>
        ) : null}
      </div>

      {pages.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-10 text-center ${workspacePanelBorder}`}
        >
          <p className="font-medium">No booking pages yet</p>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Create a page to publish your first scheduling link.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pages.map((page) => {
            const url = publicBookUrl(page.slug);
            return (
              <div
                key={page.id}
                className={`rounded-2xl border p-5 ${workspacePanelBorder}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={pageHref.replace('[pageId]', page.id)}
                        className="truncate text-base font-semibold hover:text-[var(--ozer-accent)]"
                      >
                        {page.title}
                      </Link>
                      <Badge
                        variant="outline"
                        className={
                          page.isActive
                            ? 'rounded-full border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'rounded-full'
                        }
                      >
                        {page.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className={`mt-1 truncate text-sm ${workspaceTextMuted}`}>
                      {url}
                    </p>
                    <p className={`mt-2 text-xs ${workspaceTextMuted}`}>
                      {page.eventTypeCount} event type
                      {page.eventTypeCount === 1 ? '' : 's'} · {page.timezone}
                    </p>
                  </div>
                  {canEdit ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={pageHref.replace('[pageId]', page.id)}>
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removePage(page)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => copyLink(page)}
                  >
                    {copiedId === page.id ? (
                      <Check className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Copy className="mr-2 h-3.5 w-3.5" />
                    )}
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    asChild
                  >
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Open
                    </a>
                  </Button>
                  {canEdit ? (
                    <div className="ml-auto flex items-center gap-2">
                      <Label
                        htmlFor={`active-${page.id}`}
                        className={`text-xs ${workspaceTextMuted}`}
                      >
                        Active
                      </Label>
                      <Switch
                        id={`active-${page.id}`}
                        checked={page.isActive}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          toggleActive(page, checked)
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle>New booking page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bp-title">Title</Label>
              <Input
                id="bp-title"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Discovery calls"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-slug">Slug</Label>
              <Input
                id="bp-slug"
                value={slug}
                onChange={(e) => {
                  const next = slugify(e.target.value);
                  setSlug(next);
                  checkSlug(next);
                }}
              />
              <p className={`text-xs ${workspaceTextMuted}`}>
                {publicBookUrl(slug || 'your-slug')}
                {slugStatus === 'ok' ? ' · Available' : null}
                {slugStatus === 'taken' ? ' · Already taken' : null}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-description">Description</Label>
              <Textarea
                id="bp-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-colour">Brand colour</Label>
                <Input
                  id="bp-colour"
                  type="color"
                  value={brandColour}
                  onChange={(e) => setBrandColour(e.target.value)}
                  className="h-10 cursor-pointer p-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending || !title || !slug || slugStatus === 'taken'}
              onClick={createPage}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
