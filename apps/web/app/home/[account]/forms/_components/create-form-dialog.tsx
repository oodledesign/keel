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
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

import { createWorkspaceFormAction } from '../_lib/server/server-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  showListingDestination: boolean;
};

export function CreateFormDialog({
  accountId,
  accountSlug,
  showListingDestination,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Contact form');
  const [destination, setDestination] =
    useState<WorkspaceFormDestination>('pipeline');
  const [pending, startTransition] = useTransition();

  function onCreate() {
    startTransition(async () => {
      try {
        const result = await createWorkspaceFormAction({
          accountId,
          name: name.trim() || 'Untitled form',
          destination,
        });
        toast.success('Form created');
        setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
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
            Choose where submissions should land. You can add fields and a
            public link next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="form-name">Name</Label>
            <Input
              id="form-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
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
