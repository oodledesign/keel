'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { TicketPriority } from '../_lib/schema/support-tickets.schema';
import {
  createSupportTicket,
  listSupportClientOrgs,
  listSupportTeamMembers,
  listSupportWebsitesForOrg,
} from '../_lib/server/server-actions';

type ClientOrgOption = { id: string; name: string };
type WebsiteOption = { id: string; name: string; domain: string | null };
type TeamMemberOption = { userId: string; name: string };

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function SupportTicketForm({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientOrgs, setClientOrgs] = useState<ClientOrgOption[]>([]);
  const [websites, setWebsites] = useState<WebsiteOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    client_org_id: '',
    website_id: '',
    priority: 'medium' as TicketPriority,
    assigned_to: '',
  });

  useEffect(() => {
    listSupportClientOrgs({ accountId })
      .then((rows) => setClientOrgs(rows ?? []))
      .catch(() => setClientOrgs([]));

    listSupportTeamMembers({ accountSlug })
      .then((rows) => setTeamMembers(rows ?? []))
      .catch(() => setTeamMembers([]));
  }, [accountId, accountSlug]);

  useEffect(() => {
    listSupportWebsitesForOrg({
      accountId,
      clientOrgId: form.client_org_id || null,
    })
      .then((rows) => {
        setWebsites(rows ?? []);
        setForm((current) => {
          if (
            current.website_id &&
            !(rows ?? []).some((site) => site.id === current.website_id)
          ) {
            return { ...current, website_id: '' };
          }
          return current;
        });
      })
      .catch(() => setWebsites([]));
  }, [accountId, form.client_org_id]);

  const listHref = pathsConfig.app.accountSupport.replace(
    '[account]',
    accountSlug,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createSupportTicket({
          accountId,
          title: form.title.trim(),
          description: form.description.trim(),
          client_org_id: form.client_org_id || null,
          website_id: form.website_id || null,
          priority: form.priority,
          assigned_to: form.assigned_to || null,
        });

        router.push(
          pathsConfig.app.accountSupportDetail
            .replace('[account]', accountSlug)
            .replace('[id]', created.id),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create ticket',
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-4 rounded-[20px] border border-white/6 bg-[var(--workspace-shell-panel)] p-5 md:p-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Brief summary of the issue"
            required
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
            placeholder="Describe the issue in detail"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Client org</Label>
            <Select
              value={form.client_org_id || '__none__'}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  client_org_id: value === '__none__' ? '' : value,
                  website_id: '',
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No client linked</SelectItem>
                {clientOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Website</Label>
            <Select
              value={form.website_id || '__none__'}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  website_id: value === '__none__' ? '' : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select website" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No website linked</SelectItem>
                {websites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.domain ? `${site.name} (${site.domain})` : site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  priority: value as TicketPriority,
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
            <Label>Assign to</Label>
            <Select
              value={form.assigned_to || '__none__'}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  assigned_to: value === '__none__' ? '' : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending} className={workspaceBtnPrimaryMd}>
          {isPending ? 'Creating…' : 'Create ticket'}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={listHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
