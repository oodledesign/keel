'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Download, Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
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
import { Switch } from '@kit/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import { Textarea } from '@kit/ui/textarea';

import {
  formatUkDateMedium,
  formatUkDateTimeMedium,
} from '~/lib/format/uk-datetime';

import {
  createContactList,
  deleteContactList,
  deleteContact,
  removeContactFromRecipientList,
  removeUnsubscribe,
  setContactSubscribed,
  upsertContact,
} from '../_lib/server/email-marketing.actions';
import { CampaignRowActions } from './campaign-row-actions';
import { EmailContactImportDialog } from './email-contact-import-flow';
import type {
  CampaignListRow,
  EmailContactRow,
  EmailUnsubscribeRow,
  RecipientListMember,
  RecipientListSummary,
} from '../_lib/server/email-marketing.loader';

import { EMAIL_CONTACT_TRADE_OPTIONS } from '../_lib/email-contact-constants';
import {
  isEditableRecipientList,
  isExcludableSystemList,
  defaultContactSourceForList,
  type EditableRecipientList,
} from '../_lib/recipient-list-constants';

const tabs = [
  ['campaigns', 'Campaigns'],
  ['lists', 'Lists'],
  ['contacts', 'Contacts'],
  ['templates', 'Templates'],
  ['unsubscribes', 'Unsubscribes'],
] as const;

function statusClass(status: string) {
  if (status === 'sent') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'sending') return 'border-sky-400/40 bg-sky-500/10 text-sky-200';
  if (status === 'cancelled') return 'border-zinc-400/40 bg-zinc-500/10 text-zinc-200';
  return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
}

export function EmailMarketingDashboard({
  activeTab,
  campaigns,
  contacts,
  unsubscribes,
  listsData,
  contactFilters,
  listFilters,
}: {
  activeTab: string;
  campaigns: CampaignListRow[];
  contacts: EmailContactRow[];
  unsubscribes: EmailUnsubscribeRow[];
  listsData: {
    summaries: RecipientListSummary[];
    selectedList: string;
    members: RecipientListMember[];
  } | null;
  contactFilters: {
    query: string;
    trade: string;
    source: string;
  };
  listFilters: {
    list: string;
    query: string;
  };
}) {
  const currentTab = tabs.some(([id]) => id === activeTab) ? activeTab : 'campaigns';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email marketing</h1>
          <p className="text-zinc-400">
            Compose branded campaigns, manage pre-signup contacts, and review metrics.
          </p>
        </div>
        <Button asChild className="bg-[#57C87F] text-[#09111F] hover:bg-[#97D9AA]">
          <Link href="/admin/email-marketing/new">
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-2">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin/email-marketing?tab=${id}`}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              currentTab === id
                ? 'bg-[#57C87F] text-[#09111F]'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {currentTab === 'campaigns' ? <CampaignsTab campaigns={campaigns} /> : null}
      {currentTab === 'lists' && listsData ? (
        <ListsTab
          summaries={listsData.summaries}
          members={listsData.members}
          filters={listFilters}
        />
      ) : null}
      {currentTab === 'contacts' ? (
        <ContactsTab contacts={contacts} filters={contactFilters} />
      ) : null}
      {currentTab === 'templates' ? <TemplatesTab /> : null}
      {currentTab === 'unsubscribes' ? <UnsubscribesTab rows={unsubscribes} /> : null}
    </div>
  );
}

function CampaignsTab({ campaigns }: { campaigns: CampaignListRow[] }) {
  return (
    <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400">Recipient list</TableHead>
              <TableHead className="text-zinc-400">Sent</TableHead>
              <TableHead className="text-zinc-400">Open rate</TableHead>
              <TableHead className="text-zinc-400">Click rate</TableHead>
              <TableHead className="text-zinc-400">Created</TableHead>
              <TableHead className="text-zinc-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow className="border-white/10">
                <TableCell colSpan={8} className="py-10 text-center text-zinc-500">
                  No campaigns yet.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id} className="border-white/10">
                  <TableCell className="font-medium text-white">{campaign.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {campaign.recipient_list.replace(/_/g, ' ')}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {campaign.sent_count}/{campaign.total_recipients}
                  </TableCell>
                  <TableCell className="text-zinc-300">{campaign.open_rate}%</TableCell>
                  <TableCell className="text-zinc-300">{campaign.click_rate}%</TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-300">
                    {formatUkDateMedium(campaign.created_at)}
                  </TableCell>
                  <TableCell>
                    <CampaignRowActions campaignId={campaign.id} status={campaign.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ListsTab({
  summaries,
  members,
  filters,
}: {
  summaries: RecipientListSummary[];
  members: RecipientListMember[];
  filters: { list: string; query: string };
}) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isPending, startTransition] = useTransition();
  const selected =
    summaries.find((summary) => summary.list === filters.list) ?? summaries[0];
  const editable = selected?.editable ?? false;
  const customListId = selected?.customListId ?? null;
  const editableList = selected && isEditableRecipientList(selected.list)
    ? (selected.list as EditableRecipientList)
    : null;
  const contactSource = editableList
    ? defaultContactSourceForList(editableList)
    : 'imported';
  const removeFromListMessage = isExcludableSystemList(selected?.list ?? '')
    ? 'Remove from this list? The contact stays in Contacts — they just won\'t receive campaigns sent to this list.'
    : 'Remove from this list? The contact stays in Contacts.';

  const pushFilters = (updates: Partial<typeof filters>) => {
    const next = { ...filters, ...updates };
    const params = new URLSearchParams({ tab: 'lists' });
    params.set('list', next.list || 'all_users');
    if (next.query) params.set('listQuery', next.query);
    router.push(`/admin/email-marketing?${params.toString()}`);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base text-white">Audience lists</CardTitle>
          <Button
            type="button"
            size="sm"
            className="bg-[#57C87F] text-[#09111F] hover:bg-[#97D9AA]"
            onClick={() => setCreateListOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New list
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {summaries.map((summary) => {
            const active = summary.list === selected?.list;
            return (
              <button
                key={summary.list}
                type="button"
                onClick={() => pushFilters({ list: summary.list })}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  active
                    ? 'border-[#57C87F]/40 bg-[#57C87F]/10'
                    : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{summary.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      {summary.description}
                      {summary.editable ? (
                        <span className="mt-1 block text-[#97D9AA]">
                          Editable — add or remove contacts on the right.
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-white/10 text-zinc-200"
                  >
                    {summary.campaignSpecific ? '—' : summary.count}
                  </Badge>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {selected?.label ?? 'List members'}
              </h2>
              <p className="text-sm text-zinc-400">
                {selected?.campaignSpecific
                  ? 'This audience is configured inside each campaign, not as a shared list.'
                  : editable
                    ? `${members.length} contact${members.length === 1 ? '' : 's'} shown${filters.query ? ' matching your search' : ''}. Add or remove contacts below — changes apply immediately to campaigns using this list.`
                    : `${members.length} subscriber${members.length === 1 ? '' : 's'} shown${filters.query ? ' matching your search' : ''}. Unsubscribed addresses are excluded.`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!selected?.campaignSpecific ? (
                <Input
                  defaultValue={filters.query}
                  placeholder="Search name or email"
                  className="max-w-sm border-white/10 bg-black/20 text-white"
                  onChange={(event) =>
                    pushFilters({ query: event.target.value.trim() })
                  }
                />
              ) : null}
              {selected?.deletable ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-400/40 text-rose-200"
                  disabled={isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete list "${selected.label}"? Contacts are not deleted.`,
                      )
                    ) {
                      return;
                    }
                    startTransition(async () => {
                      try {
                        await deleteContactList(selected.customListId!);
                        toast.success('List deleted');
                        pushFilters({ list: 'pre_signup_contacts' });
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Failed to delete list',
                        );
                      }
                    });
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete list
                </Button>
              ) : null}
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <ContactDialog
                    defaultSource={contactSource}
                    fixedSource={
                      editableList === 'beta_contacts' ? 'beta' : undefined
                    }
                    customListId={customListId}
                    systemListKey={editableList}
                  />
                  <Button
                    variant="outline"
                    className="border-white/10"
                    onClick={() => setImportOpen(true)}
                  >
                    Import CSV
                  </Button>
                  <EmailContactImportDialog
                    open={importOpen}
                    onOpenChange={setImportOpen}
                    contactSource={
                      editableList === 'beta_contacts' ? 'beta' : 'imported'
                    }
                    customListId={customListId}
                    onImported={() => router.refresh()}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {selected?.campaignSpecific ? (
          <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
            <CardContent className="py-10 text-center text-sm text-zinc-400">
              Choose <span className="text-zinc-200">Manual addresses</span> or{' '}
              <span className="text-zinc-200">Custom users</span> when composing a
              campaign to define who receives that send.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Name</TableHead>
                    <TableHead className="text-zinc-400">Email</TableHead>
                    <TableHead className="text-zinc-400">Type</TableHead>
                    <TableHead className="text-zinc-400">Tier / trade</TableHead>
                    <TableHead className="text-zinc-400">Last sign-in</TableHead>
                    {editable ? (
                      <TableHead className="text-zinc-400">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow className="border-white/10">
                      <TableCell
                        colSpan={editable ? 6 : 5}
                        className="py-10 text-center text-zinc-500"
                      >
                        No subscribers in this list
                        {filters.query ? ' matching your search' : ''}.
                        {editable ? ' Use Add contact to get started.' : ''}
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow
                        key={`${member.kind}-${member.email}`}
                        className="border-white/10"
                      >
                        <TableCell className="text-white">
                          {member.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-zinc-300">{member.email}</TableCell>
                        <TableCell className="text-zinc-300">
                          {member.kind === 'contact' ? 'Contact' : 'User'}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {member.tier
                            ? member.tier.replace(/_/g, ' ')
                            : member.trade ?? '—'}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {member.lastSignInAt
                            ? formatUkDateMedium(member.lastSignInAt)
                            : member.kind === 'contact'
                              ? '—'
                              : 'Never'}
                        </TableCell>
                        {editable && member.kind === 'contact' && member.contactId ? (
                          <TableCell className="space-x-2 whitespace-nowrap">
                            <ContactDialog
                              member={member}
                              defaultSource={contactSource}
                              fixedSource={
                                editableList === 'beta_contacts' ? 'beta' : undefined
                              }
                              triggerIcon={<Pencil className="h-4 w-4" />}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isPending}
                              className="border-rose-400/40 text-rose-200"
                              onClick={() => {
                                if (!window.confirm(removeFromListMessage)) {
                                  return;
                                }

                                startTransition(async () => {
                                  try {
                                    await removeContactFromRecipientList({
                                      contactId: member.contactId!,
                                      list: selected!.list,
                                    });
                                    toast.success('Removed from list');
                                    router.refresh();
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : 'Failed to remove from list',
                                    );
                                  }
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        ) : editable ? (
                          <TableCell className="text-zinc-500">—</TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
        <DialogContent className="border-white/10 bg-[var(--workspace-shell-panel)] text-white">
          <DialogHeader>
            <DialogTitle>Create contact list</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <InputField
              label="List name"
              value={newListName}
              onChange={setNewListName}
            />
            <div className="space-y-2">
              <Label className="text-white">Description (optional)</Label>
              <Textarea
                value={newListDescription}
                onChange={(event) => setNewListDescription(event.target.value)}
                className="border-white/10 bg-black/20 text-white"
                rows={3}
              />
            </div>
            <Button
              disabled={isPending || !newListName.trim()}
              className="bg-[#57C87F] text-[#09111F] hover:bg-[#97D9AA]"
              onClick={() =>
                startTransition(async () => {
                  try {
                    const created = await createContactList({
                      name: newListName.trim(),
                      description: newListDescription.trim() || null,
                    });
                    toast.success('List created');
                    setCreateListOpen(false);
                    setNewListName('');
                    setNewListDescription('');
                    pushFilters({ list: created.listKey });
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Failed to create list',
                    );
                  }
                })
              }
            >
              Create list
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactsTab({
  contacts,
  filters,
}: {
  contacts: EmailContactRow[];
  filters: { query: string; trade: string; source: string };
}) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pushFilters = (updates: Partial<typeof filters>) => {
    const next = { ...filters, ...updates };
    const params = new URLSearchParams({ tab: 'contacts' });
    if (next.query) params.set('query', next.query);
    if (next.trade) params.set('trade', next.trade);
    if (next.source) params.set('source', next.source);
    router.push(`/admin/email-marketing?${params.toString()}`);
  };

  const exportCsv = () => {
    const header = ['first_name', 'last_name', 'email', 'trade', 'source', 'subscribed'];
    const rows = contacts.map((contact) =>
      [
        contact.first_name,
        contact.last_name,
        contact.email,
        contact.trade ?? '',
        contact.source ?? '',
        String(contact.subscribed),
      ]
        .map((value) => `"${value.replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tradeways-email-contacts.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ContactDialog />
        <Button
          variant="outline"
          className="border-white/10"
          onClick={() => setImportOpen(true)}
        >
          Import CSV
        </Button>
        <EmailContactImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => router.refresh()}
        />
        <Button variant="outline" className="border-white/10" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export all
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4 md:grid-cols-3">
        <Input
          defaultValue={filters.query}
          placeholder="Search name or email"
          className="border-white/10 bg-black/20 text-white"
          onChange={(event) => pushFilters({ query: event.target.value.trim() })}
        />
        <Select
          value={filters.trade || '__all__'}
          onValueChange={(trade) => pushFilters({ trade: trade === '__all__' ? '' : trade })}
        >
          <SelectTrigger className="border-white/10 bg-black/20 text-white">
            <SelectValue placeholder="Trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All trades</SelectItem>
            {EMAIL_CONTACT_TRADE_OPTIONS.map((trade) => (
              <SelectItem key={trade} value={trade}>{trade}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.source || '__all__'}
          onValueChange={(source) => pushFilters({ source: source === '__all__' ? '' : source })}
        >
          <SelectTrigger className="border-white/10 bg-black/20 text-white">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="interest_form">Interest form</SelectItem>
            <SelectItem value="imported">Imported</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Name</TableHead>
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Trade</TableHead>
                <TableHead className="text-zinc-400">Source</TableHead>
                <TableHead className="text-zinc-400">Subscribed</TableHead>
                <TableHead className="text-zinc-400">Added</TableHead>
                <TableHead className="text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className="border-white/10">
                  <TableCell className="text-white">
                    {contact.first_name} {contact.last_name}
                    {contact.has_signed_up ? (
                      <Badge variant="outline" className="ml-2 border-emerald-400/40 text-emerald-200">
                        signed up
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-zinc-300">{contact.email}</TableCell>
                  <TableCell className="text-zinc-300">{contact.trade ?? '—'}</TableCell>
                  <TableCell className="text-zinc-300">{contact.source ?? 'manual'}</TableCell>
                  <TableCell>
                    <Switch
                      checked={contact.subscribed}
                      onCheckedChange={(checked) =>
                        startTransition(async () => {
                          await setContactSubscribed(contact.id, checked);
                          router.refresh();
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {formatUkDateMedium(contact.created_at)}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <ContactDialog contact={contact} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-rose-400/40 text-rose-200"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteContact(contact.id);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ContactDialog({
  contact,
  member,
  defaultSource = 'manual',
  fixedSource,
  customListId = null,
  systemListKey = null,
  triggerIcon,
}: {
  contact?: EmailContactRow;
  member?: RecipientListMember;
  defaultSource?: string;
  fixedSource?: string;
  customListId?: string | null;
  systemListKey?: EditableRecipientList | null;
  triggerIcon?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const parseMemberName = (name: string | null | undefined) => {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
    };
  };

  const memberName = member ? parseMemberName(member.name) : null;
  const editing = Boolean(contact?.id ?? member?.contactId);

  const [form, setForm] = useState({
    firstName: contact?.first_name ?? memberName?.firstName ?? '',
    lastName: contact?.last_name ?? memberName?.lastName ?? '',
    email: contact?.email ?? member?.email ?? '',
    trade: contact?.trade ?? member?.trade ?? '',
    source: contact?.source ?? fixedSource ?? defaultSource,
    notes: contact?.notes ?? '',
    subscribed: contact?.subscribed ?? true,
  });

  const resetForm = () => {
    setForm({
      firstName: contact?.first_name ?? memberName?.firstName ?? '',
      lastName: contact?.last_name ?? memberName?.lastName ?? '',
      email: contact?.email ?? member?.email ?? '',
      trade: contact?.trade ?? member?.trade ?? '',
      source: contact?.source ?? fixedSource ?? defaultSource,
      notes: contact?.notes ?? '',
      subscribed: contact?.subscribed ?? true,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size={editing ? 'sm' : 'default'}
          variant={editing ? 'outline' : 'default'}
          className={
            editing
              ? 'border-white/10'
              : 'bg-[#57C87F] text-[#09111F] hover:bg-[#97D9AA]'
          }
        >
          {triggerIcon ?? null}
          {!triggerIcon ? (editing ? 'Edit' : 'Add contact') : null}
          {triggerIcon ? <span className="sr-only">Edit contact</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[var(--workspace-shell-panel)] text-white">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit contact' : 'Add contact'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <InputField label="First name" value={form.firstName} onChange={(firstName) => setForm((prev) => ({ ...prev, firstName }))} />
          <InputField label="Last name" value={form.lastName} onChange={(lastName) => setForm((prev) => ({ ...prev, lastName }))} />
          <InputField label="Email" value={form.email} onChange={(email) => setForm((prev) => ({ ...prev, email }))} />
          <div className="space-y-2">
            <Label>Trade</Label>
            <Select value={form.trade || 'Other'} onValueChange={(trade) => setForm((prev) => ({ ...prev, trade }))}>
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_CONTACT_TRADE_OPTIONS.map((trade) => (
                  <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="border-white/10 bg-black/20 text-white" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Subscribed</Label>
            <Switch checked={form.subscribed} onCheckedChange={(subscribed) => setForm((prev) => ({ ...prev, subscribed }))} />
          </div>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await upsertContact({
                    id: contact?.id ?? member?.contactId ?? null,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                    trade: form.trade,
                    notes: form.notes,
                    subscribed: form.subscribed,
                    source: fixedSource ?? contact?.source ?? defaultSource,
                    customListId: editing ? null : customListId,
                    systemListKey: editing ? null : systemListKey,
                  });
                  toast.success('Contact saved');
                  setOpen(false);
                  router.refresh();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to save contact');
                }
              })
            }
          >
            Save contact
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-white/10 bg-black/20 text-white"
      />
    </div>
  );
}

function TemplatesTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-white">Announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementTemplatePreview />
          <p className="mt-4 text-sm text-zinc-400">
            Large hero heading, optional image, rich body copy, and one primary CTA.
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-white">Newsletter</CardTitle>
        </CardHeader>
        <CardContent>
          <NewsletterTemplatePreview />
          <p className="mt-4 text-sm text-zinc-400">
            Slim header, intro copy, up to three feature/news blocks, and one CTA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AnnouncementTemplatePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f5f5f5]">
      <div className="bg-[#1A3A2E] px-6 py-7 text-center text-lg font-extrabold tracking-wide text-white">
        Tradeways
      </div>
      <div className="relative h-28 bg-gradient-to-br from-[#1A3A2E]/25 via-[#4CC68A]/20 to-[#1A3A2E]/10">
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.18em] text-[#1A3A2E]/55">
          Hero image
        </div>
      </div>
      <div className="space-y-3 bg-white px-6 py-8 text-center">
        <div className="mx-auto h-7 w-[80%] max-w-[220px] rounded-md bg-[#1A3A2E]/15" />
        <div className="mx-auto h-3 w-[60%] max-w-[160px] rounded bg-zinc-200" />
        <div className="mx-auto mt-4 space-y-2">
          <div className="h-2.5 w-full rounded bg-zinc-200" />
          <div className="h-2.5 w-[92%] rounded bg-zinc-200" />
          <div className="h-2.5 w-[80%] rounded bg-zinc-200" />
        </div>
        <div className="mx-auto mt-6 h-10 w-36 rounded-full bg-[#4CC68A]" />
      </div>
      <div className="border-t border-zinc-200 bg-[#f5f5f5] px-6 py-4 text-center">
        <div className="mx-auto h-2 w-24 rounded bg-zinc-300" />
        <div className="mx-auto mt-2 h-2 w-16 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function NewsletterTemplatePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f5f5f5]">
      <div className="bg-[#1A3A2E] px-6 py-4 text-center text-base font-extrabold tracking-wide text-white">
        Tradeways
      </div>
      <div className="space-y-4 bg-white px-6 py-6">
        <div className="space-y-2">
          <div className="h-6 w-3/4 rounded-md bg-[#1A3A2E]/15" />
          <div className="h-2.5 w-full rounded bg-zinc-200" />
          <div className="h-2.5 w-5/6 rounded bg-zinc-200" />
        </div>
        <div className="space-y-2.5 pt-1">
          {[1, 2, 3].map((block) => (
            <div
              key={block}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="mb-2 h-3 w-2/5 rounded bg-[#1A3A2E]/15" />
              <div className="h-2 w-full rounded bg-zinc-200" />
              <div className="mt-1.5 h-2 w-[92%] rounded bg-zinc-200" />
            </div>
          ))}
        </div>
        <div className="mx-auto h-10 w-36 rounded-full bg-[#4CC68A]" />
      </div>
      <div className="border-t border-zinc-200 bg-[#f5f5f5] px-6 py-4 text-center">
        <div className="mx-auto h-2 w-24 rounded bg-zinc-300" />
        <div className="mx-auto mt-2 h-2 w-16 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

function UnsubscribesTab({ rows }: { rows: EmailUnsubscribeRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-zinc-400">Email</TableHead>
              <TableHead className="text-zinc-400">Unsubscribed</TableHead>
              <TableHead className="text-zinc-400">Reason</TableHead>
              <TableHead className="text-zinc-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="border-white/10">
                <TableCell className="text-white">{row.email}</TableCell>
                <TableCell className="text-zinc-300">
                  {formatUkDateTimeMedium(row.unsubscribed_at)}
                </TableCell>
                <TableCell className="text-zinc-300">{row.reason ?? '—'}</TableCell>
                <TableCell>
                  <Button
                    disabled={isPending}
                    variant="outline"
                    size="sm"
                    className="border-white/10"
                    onClick={() => {
                      if (!confirm(`Re-subscribe ${row.email}?`)) return;
                      startTransition(async () => {
                        await removeUnsubscribe(row.id);
                        router.refresh();
                      });
                    }}
                  >
                    Re-subscribe
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
