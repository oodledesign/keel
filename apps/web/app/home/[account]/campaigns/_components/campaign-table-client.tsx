'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Columns3, Plus, Trash2, UserPlus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { CampaignProjectDetail } from '~/lib/campaign-projects/types';

import {
  addClientToCampaign,
  removeClientFromCampaign,
  updateClientFieldValue,
} from '../_lib/server/server-actions';
import { CampaignFieldCell } from './campaign-field-cell';
import { CampaignManageColumnsDialog } from './campaign-manage-columns-dialog';

type LinkOptions = {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
};

export function CampaignTableClient({
  accountId,
  accountSlug,
  project: initialProject,
  linkOptions,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  project: CampaignProjectDetail;
  linkOptions: LinkOptions;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [pending, startTransition] = useTransition();

  const project = initialProject;

  const clientsInProject = useMemo(
    () => new Set(project.rows.map((row) => row.clientId)),
    [project.rows],
  );

  const availableClients = linkOptions.clients.filter(
    (client) => !clientsInProject.has(client.id),
  );

  const clientHref = (clientId: string) =>
    `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${clientId}`;

  const saveValue = (
    clientId: string,
    fieldId: string,
    value: string | number | boolean | null,
  ) => {
    startTransition(async () => {
      try {
        await updateClientFieldValue({
          accountId,
          accountSlug,
          projectId: project.id,
          clientId,
          fieldId,
          value,
        });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save');
      }
    });
  };

  const handleAddClient = () => {
    if (!selectedClientId) {
      toast.error('Select a client');
      return;
    }

    startTransition(async () => {
      try {
        await addClientToCampaign({
          accountId,
          accountSlug,
          projectId: project.id,
          clientId: selectedClientId,
        });
        setAddClientOpen(false);
        setSelectedClientId('');
        toast.success('Client added to campaign');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to add client',
        );
      }
    });
  };

  const handleRemoveClient = (clientId: string) => {
    startTransition(async () => {
      try {
        await removeClientFromCampaign({
          accountId,
          accountSlug,
          projectId: project.id,
          clientId,
        });
        toast.success('Client removed from campaign');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to remove client',
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
            {project.name}
          </h1>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {project.clientCount} client{project.clientCount === 1 ? '' : 's'} ·{' '}
            {project.fields.length} column
            {project.fields.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            onClick={() => setColumnsOpen(true)}
          >
            <Columns3 className="mr-2 h-4 w-4" />
            Manage columns
          </Button>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={() => setAddClientOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add client
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                <th className="sticky left-0 z-10 min-w-[180px] bg-[#0f1729] px-4 py-3 text-left text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Client
                </th>
                {project.fields.map((field) => (
                  <th
                    key={field.id}
                    className="min-w-[160px] px-3 py-3 text-left text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase"
                  >
                    {field.label}
                  </th>
                ))}
                {canEdit ? (
                  <th className="w-12 px-2 py-3" aria-label="Actions" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {project.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={project.fields.length + (canEdit ? 2 : 1)}
                    className="px-4 py-10 text-center text-[var(--workspace-shell-text-muted)]"
                  >
                    No clients in this campaign yet. Add clients to start
                    tracking.
                  </td>
                </tr>
              ) : (
                project.rows.map((row) => (
                  <tr
                    key={row.clientId}
                    className="border-b border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                  >
                    <td className="sticky left-0 z-10 bg-[var(--workspace-shell-panel)] px-4 py-2">
                      <Link
                        href={clientHref(row.clientId)}
                        className="font-medium text-[var(--ozer-accent-muted)] hover:underline"
                      >
                        {row.displayName}
                      </Link>
                      {row.email ? (
                        <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                          {row.email}
                        </p>
                      ) : null}
                    </td>
                    {project.fields.map((field) => (
                      <td key={field.id} className="px-3 py-2 align-top">
                        <CampaignFieldCell
                          field={field}
                          value={row.values[field.id] ?? null}
                          canEdit={canEdit}
                          accountSlug={accountSlug}
                          linkOptions={linkOptions}
                          onChange={(value) =>
                            saveValue(row.clientId, field.id, value)
                          }
                        />
                      </td>
                    ))}
                    {canEdit ? (
                      <td className="px-2 py-2 align-top">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={pending}
                          className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                          onClick={() => handleRemoveClient(row.clientId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CampaignManageColumnsDialog
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        projectId={project.id}
        fields={project.fields}
        canEdit={canEdit}
        onUpdated={() => router.refresh()}
      />

      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add client to campaign</DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Link an existing workspace client to this campaign tracker.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
              {availableClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={pending || !selectedClientId}
            className="w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            onClick={handleAddClient}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add to campaign
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
