'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FileSpreadsheet, Plus, Table2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

import pathsConfig from '~/config/paths.config';
import type { CampaignProject } from '~/lib/campaign-projects/types';

import {
  createCampaignProject,
  importWebsiteRevampCampaign,
} from '../../_lib/campaign/server/server-actions';

export function CampaignsListClient({
  accountId,
  accountSlug,
  projects,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  projects: CampaignProject[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<'blank' | 'website_revamp'>('blank');
  const [pending, startTransition] = useTransition();

  const detailPath = (id: string) =>
    pathsConfig.app.accountCampaignDetail
      .replace('[account]', accountSlug)
      .replace('[id]', id);

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    startTransition(async () => {
      try {
        const project = await createCampaignProject({
          accountId,
          accountSlug,
          name: name.trim(),
          template,
        });
        setCreateOpen(false);
        setName('');
        setTemplate('blank');
        toast.success('Campaign created');
        router.push(detailPath(project.id));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create campaign');
      }
    });
  };

  const handleImportWebsiteRevamp = () => {
    startTransition(async () => {
      try {
        const project = await importWebsiteRevampCampaign({ accountId, accountSlug });
        toast.success('Website Revamp Campaign imported');
        router.push(detailPath(project.id));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Import failed');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Campaign trackers</h1>
          <p className="text-sm text-zinc-400">
            Spreadsheet-style project boards with custom columns per campaign.
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={handleImportWebsiteRevamp}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import Website Revamp
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New campaign
            </Button>
          </div>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[var(--workspace-shell-panel)] px-6 py-14 text-center">
          <Table2 className="mx-auto h-10 w-10 text-zinc-500" />
          <p className="mt-4 text-white">No campaign trackers yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            Create a campaign or import the Website Revamp template for Thistleleaf.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={detailPath(project.id)}
              className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)] transition hover:border-white/20"
            >
              <p className="font-semibold text-white">{project.name}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {project.clientCount} client{project.clientCount === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/10 bg-[var(--workspace-shell-panel)] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New campaign tracker</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Create a project board with custom columns for tracking clients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-zinc-500">Name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Website Revamp Campaign"
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Template</Label>
              <Select
                value={template}
                onValueChange={(value) =>
                  setTemplate(value as 'blank' | 'website_revamp')
                }
              >
                <SelectTrigger className="mt-1 border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  <SelectItem value="blank">Blank (add your own columns)</SelectItem>
                  <SelectItem value="website_revamp">Website revamp campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={pending}
              className="w-full bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
              onClick={handleCreate}
            >
              Create campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
