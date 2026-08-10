'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ClipboardList, LayoutGrid } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
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
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { WEBSITE_REVAMP_CAMPAIGN_FIELDS } from '~/lib/campaign-projects/website-revamp-template';
import { unwrapListClientsResult } from '~/lib/clients/unwrap-list-clients-result';
import {
  type ProjectsUiVariant,
  projectDetailHref,
} from '~/lib/projects/project-paths';
import {
  PROJECT_TYPE_META,
  type ProjectType,
} from '~/lib/projects/project-types';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

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
  uiVariant?: ProjectsUiVariant;
  defaultType?: ProjectType;
  personalScope?: boolean;
  projectDetailPathBuilder?: (id: string) => string;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  onSuccess,
  uiVariant = 'projects',
  defaultType = 'delivery',
  personalScope = false,
  projectDetailPathBuilder,
}: Props) {
  const router = useRouter();
  const isMaintenance = uiVariant === 'maintenance';
  const isSimple = uiVariant === 'simple';
  const [projectType, setProjectType] = useState<ProjectType>(
    isMaintenance || isSimple ? 'delivery' : defaultType,
  );
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [isOngoing, setIsOngoing] = useState(false);
  const [isPhased, setIsPhased] = useState(false);
  const [valuePence, setValuePence] = useState('');
  const [campaignTemplate, setCampaignTemplate] = useState<
    'blank' | 'website_revamp'
  >('blank');
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<
    { id: string; display_name: string | null }[]
  >([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setClientId('');
    setDescription('');
    setStatus('pending');
    setPriority('medium');
    setDueDate('');
    setIsOngoing(false);
    setIsPhased(false);
    setValuePence('');
    setCampaignTemplate('blank');
    setProjectType(isMaintenance || isSimple ? 'delivery' : defaultType);
  };

  useEffect(() => {
    if (!open) return;
    setProjectType(isMaintenance || isSimple ? 'delivery' : defaultType);
  }, [open, defaultType, isMaintenance, isSimple]);

  useEffect(() => {
    if (!open || !accountId || projectType !== 'delivery' || isSimple) return;

    setClientsLoading(true);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        const unwrapped = unwrapListClientsResult<{
          id: string;
          display_name: string | null;
        }>(r);
        if (!unwrapped.ok) {
          setClients([]);
          return;
        }
        setClients(unwrapped.data);
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [open, accountId, projectType, isSimple]);

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const resolveDetailPath = (id: string) => {
    if (projectDetailPathBuilder) {
      return projectDetailPathBuilder(id);
    }

    return projectDetailHref(accountSlug, id, personalScope);
  };

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
        router.push(resolveDetailPath(project.id));
        router.refresh();
        return;
      }

      const job = (await createJob({
        accountId,
        title: name.trim(),
        description: description.trim() || undefined,
        client_id: isSimple ? undefined : clientId.trim() || undefined,
        status: (isSimple ? 'pending' : status) as
          | 'pending'
          | 'in_progress'
          | 'on_hold'
          | 'completed'
          | 'cancelled',
        priority: (isSimple ? 'medium' : priority) as
          | 'low'
          | 'medium'
          | 'high'
          | 'urgent',
        due_date: isSimple || isOngoing
          ? undefined
          : dueDate
            ? new Date(dueDate)
            : undefined,
        is_ongoing: isSimple ? false : isOngoing,
        is_phased: isSimple ? false : isPhased,
        value_pence: isSimple
          ? undefined
          : valuePence
            ? Math.round(parseFloat(valuePence) * 100)
            : undefined,
      })) as { id?: string };

      toast.success(
        isMaintenance ? 'Maintenance job created' : 'Project created',
      );
      handleOpenChange(false);
      onSuccess();

      if (job?.id && (isSimple || personalScope || projectDetailPathBuilder)) {
        router.push(resolveDetailPath(job.id));
        router.refresh();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle = isMaintenance
    ? 'Create maintenance job'
    : 'Create project';
  const dialogDescription = isMaintenance
    ? 'Track phased maintenance work for a client with tasks and timeline.'
    : isSimple
      ? 'Name a project for DIY, parties, holidays, or anything else you are planning.'
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
          {!isMaintenance && !isSimple ? (
            <div className="space-y-2">
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                Project type
              </Label>
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
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)]',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-2 flex h-9 w-9 items-center justify-center rounded-lg',
                          selected
                            ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)] shadow-sm'
                            : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
                        )}
                      >
                        <Icon
                          className="h-5 w-5"
                          strokeWidth={selected ? 2.25 : 2}
                        />
                      </div>
                      <span className="text-sm font-medium text-[var(--workspace-shell-text)]">
                        {meta.label}
                      </span>
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
            <Label
              htmlFor="project-name"
              className="text-[var(--workspace-shell-text-muted)]"
            >
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
                  : isSimple
                    ? 'Kitchen renovation, birthday party…'
                    : 'ChurchWorks website build'
              }
              autoFocus
            />
          </div>

          {isSimple ? (
            <div>
              <Label
                htmlFor="description"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Notes (optional)
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={fieldClass}
                placeholder="Details, ideas, or what needs doing"
              />
            </div>
          ) : projectType === 'delivery' ? (
            <>
              <div>
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Client
                </Label>
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
                <Label
                  htmlFor="description"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
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
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Status
                  </Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={fieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={workspaceSelectContentClass}>
                      <SelectItem
                        value="pending"
                        className={workspaceSelectItemClass}
                      >
                        Pending
                      </SelectItem>
                      <SelectItem
                        value="in_progress"
                        className={workspaceSelectItemClass}
                      >
                        In progress
                      </SelectItem>
                      <SelectItem
                        value="on_hold"
                        className={workspaceSelectItemClass}
                      >
                        On hold
                      </SelectItem>
                      <SelectItem
                        value="completed"
                        className={workspaceSelectItemClass}
                      >
                        Completed
                      </SelectItem>
                      <SelectItem
                        value="cancelled"
                        className={workspaceSelectItemClass}
                      >
                        Cancelled
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Priority
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className={fieldClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={workspaceSelectContentClass}>
                      <SelectItem
                        value="low"
                        className={workspaceSelectItemClass}
                      >
                        Low
                      </SelectItem>
                      <SelectItem
                        value="medium"
                        className={workspaceSelectItemClass}
                      >
                        Medium
                      </SelectItem>
                      <SelectItem
                        value="high"
                        className={workspaceSelectItemClass}
                      >
                        High
                      </SelectItem>
                      <SelectItem
                        value="urgent"
                        className={workspaceSelectItemClass}
                      >
                        Urgent
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="due_date"
                    className="text-[var(--workspace-shell-text-muted)]"
                  >
                    Due date
                  </Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={isOngoing ? '' : dueDate}
                    disabled={isOngoing}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      if (e.target.value) setIsOngoing(false);
                    }}
                    className={fieldClass}
                  />
                  <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]">
                    <Checkbox
                      checked={isOngoing}
                      onCheckedChange={(checked) => {
                        const next = checked === true;
                        setIsOngoing(next);
                        if (next) setDueDate('');
                      }}
                    />
                    Ongoing — no deadline
                  </label>
                </div>
                <div>
                  <Label
                    htmlFor="value"
                    className="text-[var(--workspace-shell-text-muted)]"
                  >
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

              <label className="flex items-start gap-2.5 text-sm text-[var(--workspace-shell-text)]">
                <Checkbox
                  checked={isPhased}
                  onCheckedChange={(checked) => setIsPhased(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  Phased project
                  <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                    Enable Phase board view. Leave off for Progress-only.
                  </span>
                </span>
              </label>
            </>
          ) : (
            <>
              <div>
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Starting template
                </Label>
                <Select
                  value={campaignTemplate}
                  onValueChange={(value) =>
                    setCampaignTemplate(value as 'blank' | 'website_revamp')
                  }
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={workspaceSelectContentClass}>
                    <SelectItem
                      value="blank"
                      className={workspaceSelectItemClass}
                    >
                      Blank — add your own columns later
                    </SelectItem>
                    <SelectItem
                      value="website_revamp"
                      className={workspaceSelectItemClass}
                    >
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
                    You can add, reorder, or remove columns after creation from
                    the campaign board.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Start with an empty tracker. Add text, status, URL, currency,
                  and other column types from the campaign view.
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
