'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

import pathsConfig from '~/config/paths.config';
import {
  WORKSPACE_FORM_DESTINATION_LABELS,
  type WorkspaceFormDestination,
} from '~/lib/workspace-forms/form-fields';
import {
  type WorkspaceFormTemplate,
  listWorkspaceFormTemplates,
  workspaceFormCreateDefaultsForTemplate,
} from '~/lib/workspace-forms/form-templates';
import {
  workspaceBtnPrimary,
  workspaceFilterActive,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { createWorkspaceFormAction } from '../_lib/server/server-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  showListingDestination: boolean;
};

const TEMPLATES = listWorkspaceFormTemplates();

export function CreateFormDialog({
  accountId,
  accountSlug,
  showListingDestination,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const contactDefaults = workspaceFormCreateDefaultsForTemplate('contact');
  const [template, setTemplate] = useState<WorkspaceFormTemplate>('contact');
  const [name, setName] = useState(contactDefaults.defaultName);
  const [nameTouched, setNameTouched] = useState(false);
  const [destination, setDestination] = useState<WorkspaceFormDestination>(
    contactDefaults.suggestedDestination,
  );
  const [pending, startTransition] = useTransition();

  function resetFormState() {
    const defaults = workspaceFormCreateDefaultsForTemplate('contact');
    setTemplate('contact');
    setName(defaults.defaultName);
    setNameTouched(false);
    setDestination(defaults.suggestedDestination);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetFormState();
    }
  }

  function selectTemplate(next: WorkspaceFormTemplate) {
    const defaults = workspaceFormCreateDefaultsForTemplate(next);
    setTemplate(next);
    if (!nameTouched) {
      setName(defaults.defaultName);
    }
    setDestination(defaults.suggestedDestination);
  }

  function onCreate() {
    startTransition(async () => {
      try {
        const result = await createWorkspaceFormAction({
          accountId,
          name: name.trim() || 'Untitled form',
          destination,
          template,
        });
        toast.success('Form created');
        onOpenChange(false);
        router.push(
          pathsConfig.app.accountFormDetail
            .replace('[account]', accountSlug)
            .replace('[formId]', result.data.id),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create form',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          className={`${workspaceBtnPrimary} rounded-xl`}
          data-test="create-form-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          New form
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a form</DialogTitle>
          <DialogDescription>
            Pick a template to start from, then choose where submissions should
            land. You can add and reorder fields next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Template</Label>
            <div
              className="grid gap-2 sm:grid-cols-3"
              data-test="create-form-templates"
            >
              {TEMPLATES.map((meta) => {
                const selected = template === meta.id;
                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() => selectTemplate(meta.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? `border-[var(--ozer-accent)]/40 ${workspaceFilterActive}`
                        : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] hover:bg-[var(--workspace-shell-panel-hover)]'
                    }`}
                    data-test={`create-form-template-${meta.id}`}
                    aria-pressed={selected}
                  >
                    <div className={`text-sm font-medium ${workspaceText}`}>
                      {meta.label}
                    </div>
                    <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="form-name">Name</Label>
            <Input
              id="form-name"
              value={name}
              onChange={(event) => {
                setNameTouched(true);
                setName(event.target.value);
              }}
              data-test="create-form-name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Destination</Label>
            <Select
              value={destination}
              onValueChange={(value) =>
                setDestination(value as WorkspaceFormDestination)
              }
            >
              <SelectTrigger data-test="create-form-destination">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pipeline">
                  {WORKSPACE_FORM_DESTINATION_LABELS.pipeline}
                </SelectItem>
                <SelectItem value="mailing_list">
                  {WORKSPACE_FORM_DESTINATION_LABELS.mailing_list}
                </SelectItem>
                <SelectItem value="submission_list">
                  {WORKSPACE_FORM_DESTINATION_LABELS.submission_list}
                </SelectItem>
                {showListingDestination ? (
                  <SelectItem value="listing_enquiry">
                    {WORKSPACE_FORM_DESTINATION_LABELS.listing_enquiry}
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending}
            onClick={onCreate}
            data-test="create-form-submit"
          >
            {pending ? 'Creating…' : 'Create form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
