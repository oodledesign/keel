'use client';

import { useEffect, useState } from 'react';

import { ClipboardList, LayoutGrid } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { WEBSITE_REVAMP_CAMPAIGN_FIELDS } from '~/lib/campaign-projects/website-revamp-template';
import {
  PROJECT_TYPE_META,
  type ProjectType,
} from '~/lib/projects/project-types';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';

import { createCampaignProject } from '../_lib/campaign/server/server-actions';
import { getErrorMessage } from '../_lib/error-message';
import { createJob } from '../_lib/server/server-actions';
import { ClientCombobox } from './client-combobox';

const TYPE_ICONS = {
  delivery: ClipboardList,
  campaign: LayoutGrid,
} as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  onSuccess: () => void;
  uiVariant?: 'projects' | 'maintenance';
  defaultType?: ProjectType;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  onSuccess,
  uiVariant = 'projects',
  defaultType = 'delivery',
}: Props) {
  const router = useRouter();
  const isMaintenance = uiVariant === 'maintenance';
  const [projectType, setProjectType] = useState<ProjectType>(
    isMaintenance ? 'delivery' : defaultType,
  );
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [valuePence, setValuePence] = useState('');
  const [campaignTemplate, setCampaignTemplate] = useState<'blank' | 'website_revamp'>(
    'blank',
  );
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<{ id: string; display_name: string | null }[]>(
    [],
  );
  const [clientsLoading, setClientsLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setClientId('');
    setDescription('');
    setStatus('pending');
    setPriority('medium');
    setDueDate('');
    setValuePence('');
    setCampaignTemplate('blank');
    setProjectType(isMaintenance ? 'delivery' : defaultType);
  };

  useEffect(() => {
    if (!open) return;
    setProjectType(isMaintenance ? 'delivery' : defaultType);
  }, [open, defaultType, isMaintenance]);

  useEffect(() => {
    if (!open || !accountId || projectType !== 'delivery') return;

    setClientsLoading(true);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        const raw = r as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClients((list || []) as { id: string; display_name: string | null }[]);
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [open, accountId, projectType]);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const projectDetailPath = (id: string) =>
    pathsConfig.app.accountProjects.replace('[account]', accountSlug) + `/${id}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (projectType === 'campaign') {
        const project = await createCampaignProject({
          accountId,
          accountSlug,
          name: name.trim(),
          template: campaignTemplate,
        });
        toast.success('Campaign tracker created');
        handleOpenChange(false);
        onSuccess();
        router.push(projectDetailPath(project.id));
        router.refresh();
        return;
      }

      await createJob({
        accountId,
        title: name.trim(),
        description: description.trim() || undefined,
        client_id: clientId.trim() || undefined,
        status: status as
          | 'pending'
          | 'in_progress'
          | 'on_hold'
          | 'completed'
          | 'cancelled',
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: dueDate ? new Date(dueDate) : undefined,
        value_pence: valuePence ? Math.round(parseFloat(valuePence) * 100) : undefined,
      });
      toast.success(isMaintenance ? 'Maintenance job created' : 'Project created');
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle = isMaintenance ? 'Create maintenance job' : 'Create project';
  const dialogDescription = isMaintenance
    ? 'Track phased maintenance work for a client with tasks and timeline.'
    : 'Choose a delivery project or a multi-client campaign tracker, then fill in the details.';

  const submitLabel =
    projectType === 'campaign'
      ? 'Create campaign'
      : isMaintenance
        ? 'Create maintenance job'
        : 'Create project';

  const fieldClass =
    'mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isMaintenance ? (
            <div className="space-y-2">
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">Project type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['delivery', 'campaign'] as const).map((type) => {
                  const meta = PROJECT_TYPE_META[type];
                  const Icon = TYPE_ICONS[meta.icon];
                  const selected = projectType === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProjectType(type)}
                      className={cn(
                        'flex flex-col items-start rounded-xl border p-3 text-left transition-colors',
                        selected
                          ? 'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent-subtle)]'
                          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)]',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-2 flex h-8 w-8 items-center justify-center rounded-lg',
                          selected
                            ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]'
                            : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-[var(--workspace-shell-text)]">{meta.label}</span>
                      <span className="mt-0.5 text-[11px] leading-snug text-[var(--workspace-shell-text-muted)]">
                        {meta.shortLabel === 'Delivery'
                          ? 'Phases, tasks & timeline'
                          : 'Custom columns per client'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
                {PROJECT_TYPE_META[projectType].description}
              </p>
            </div>
          ) : null}

          <div>
            <Label htmlFor="project-name" className="text-[var(--workspace-shell-text-muted)]">
              {projectType === 'campaign' ? 'Campaign name' : 'Project name'} *
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              placeholder={
                projectType === 'campaign'
                  ? 'Website revamp outreach'
                  : 'ChurchWorks website build'
              }
              autoFocus
            />
          </div>

          {projectType === 'delivery' ? (
            <>
              <div>
                <Label className="text-[var(--workspace-shell-text-muted)]">Client</Label>
                <div className="mt-1">
                  <ClientCombobox
                    clients={clients}
                    value={clientId}
                    onValueChange={setClientId}
                    loading={clientsLoading}
                    placeholder="Select client (optional)"
                    addClientHref={pathsConfig.app.accountClients.replace(
                      '[account]',
                      accountSlug,
                    )}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-[var(--workspace-shell-text-muted)]">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={fieldClass}
                  placeholder="Scope, milestones, or notes for your team"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[var(--workspace-shell-text-muted)]">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={fieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[#1A2535] text-[var(--workspace-shell-text)]">
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="on_hold">On hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[var(--workspace-shell-text-muted)]">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className={fieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[#1A2535] text-[var(--workspace-shell-text)]">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="due_date" className="text-[var(--workspace-shell-text-muted)]">
                    Due date
                  </Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <Label htmlFor="value" className="text-[var(--workspace-shell-text-muted)]">
                    Value (£)
                  </Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valuePence}
                    onChange={(e) => setValuePence(e.target.value)}
                    className={fieldClass}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-[var(--workspace-shell-text-muted)]">Starting template</Label>
                <Select
                  value={campaignTemplate}
                  onValueChange={(value) =>
                    setCampaignTemplate(value as 'blank' | 'website_revamp')
                  }
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[#1A2535] text-[var(--workspace-shell-text)]">
                    <SelectItem value="blank">
                      Blank — add your own columns later
                    </SelectItem>
                    <SelectItem value="website_revamp">
                      Website revamp — outreach & pricing columns
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {campaignTemplate === 'website_revamp' ? (
                <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
                  <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                    Included custom columns
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {WEBSITE_REVAMP_CAMPAIGN_FIELDS.map((field) => (
                      <li
                        key={field.fieldKey}
                        className="rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)]"
                      >
                        {field.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
                    You can add, reorder, or remove columns after creation from the
                    campaign board.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Start with an empty tracker. Add text, status, URL, currency, and
                  other column types from the campaign view.
                </p>
              )}
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            >
              {submitting ? 'Creating…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
