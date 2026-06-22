'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import { Form } from '@kit/ui/form';
import { toast } from '@kit/ui/sonner';

import {
  getWorkspaceFocusSettings,
  syncHolidayModeToGmail,
  upsertWorkspaceFocusSettings,
} from '~/home/[account]/settings/focus/actions';
import {
  WorkspaceFocusSettingsSchema,
  type WorkspaceFocusSettings,
} from '~/home/[account]/settings/focus/_lib/focus-settings.schema';

import { buildFocusFormDefaults } from '../_lib/focus-form';
import { HolidayModeSection } from './HolidayModeSection';
import { OOOSection } from './OOOSection';
import { WorkHoursSection } from './WorkHoursSection';

type FocusSettingsFormProps = {
  accountId: string;
  accountSlug: string;
  userId: string;
  initialSettings: WorkspaceFocusSettings | null;
};

export function FocusSettingsForm({
  accountId,
  accountSlug,
  userId,
  initialSettings,
}: FocusSettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [persisted, setPersisted] = useState(initialSettings);

  const form = useForm({
    resolver: zodResolver(WorkspaceFocusSettingsSchema),
    defaultValues: buildFocusFormDefaults(initialSettings),
    mode: 'onChange',
  });

  const { isDirty } = form.formState;

  function handleSubmit() {
    startTransition(async () => {
      const values = form.getValues();
      const result = await upsertWorkspaceFocusSettings(accountId, values);

      if (!result.success) {
        toast.error(result.error ?? 'Could not save focus settings');
        return;
      }

      const refreshed = await getWorkspaceFocusSettings(accountId);
      setPersisted(refreshed);

      if (refreshed) {
        form.reset(buildFocusFormDefaults(refreshed));
      } else {
        form.reset(values);
      }

      if (result.gmailSyncError) {
        toast.warning('Settings saved. Gmail sync failed.', {
          action: {
            label: 'Retry',
            onClick: () => {
              void syncHolidayModeToGmail(accountId, userId).then((sync) => {
                if (!sync.success) {
                  toast.error(sync.error ?? 'Gmail sync failed');
                } else {
                  toast.success('Gmail vacation responder updated');
                }
              });
            },
          },
        });
        return;
      }

      toast.success('Focus settings saved');
    });
  }

  return (
    <Form {...form}>
      <form
        className="space-y-6 pb-24"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-white">
            Focus & Availability
          </h1>
          <p className="text-sm text-zinc-400">
            Control work hours, holiday mode, and automatic out-of-office replies
            for this workspace.
          </p>
        </div>

        <WorkHoursSection form={form} />
        <HolidayModeSection
          form={form}
          accountId={accountId}
          accountSlug={accountSlug}
          userId={userId}
          persisted={persisted}
        />
        <OOOSection form={form} accountId={accountId} persisted={persisted} />

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)]/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm text-zinc-400">
            {isDirty ? (
              <span className="text-amber-200">Unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </p>
          <Button
            type="submit"
            disabled={pending || !isDirty}
            className="keel-gradient-btn min-w-[9rem]"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
