'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  getActivityPrivacySettings,
  upsertActivityPrivacySettings,
} from '~/home/[account]/settings/activity/actions';
import {
  ActivityPrivacyFormSchema,
  type ActivityPrivacyFormValues,
  type ActivityPrivacySettings,
} from '~/home/[account]/settings/activity/_lib/activity-privacy-settings.schema';
import { buildActivityPrivacyFormDefaults } from '~/home/[account]/settings/activity/_lib/activity-privacy-form';

type ActivityPrivacySettingsFormProps = {
  accountId: string;
  initialSettings: ActivityPrivacySettings | null;
};

export function ActivityPrivacySettingsForm({
  accountId,
  initialSettings,
}: ActivityPrivacySettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [persisted, setPersisted] = useState(initialSettings);

  const form = useForm<ActivityPrivacyFormValues>({
    resolver: zodResolver(ActivityPrivacyFormSchema),
    defaultValues: buildActivityPrivacyFormDefaults(initialSettings),
    mode: 'onChange',
  });

  const { isDirty } = form.formState;
  const trackingEnabled = form.watch('tracking_enabled');

  function handleSubmit(values: ActivityPrivacyFormValues) {
    startTransition(async () => {
      const result = await upsertActivityPrivacySettings(accountId, values);

      if (!result.success) {
        toast.error(result.error ?? 'Could not save activity settings');
        return;
      }

      const refreshed = await getActivityPrivacySettings(accountId);
      setPersisted(refreshed);

      if (refreshed) {
        form.reset(buildActivityPrivacyFormDefaults(refreshed));
      } else {
        form.reset(values);
      }

      toast.success(
        values.tracking_enabled
          ? 'Activity tracking enabled for this workspace'
          : 'Activity privacy settings saved',
      );
    });
  }

  return (
    <Form {...form}>
      <form
        className="space-y-6 pb-24"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--workspace-shell-text-muted)]" />
            <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
              Activity tracking
            </h1>
          </div>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Control what KeelAssistant captures and uploads for this workspace.
            Tracking is opt-in — uploads are blocked until you enable it here.
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
          <FormField
            control={form.control}
            name="tracking_enabled"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <FormLabel className="text-base font-semibold text-[var(--workspace-shell-text)]">
                    Enable activity tracking
                  </FormLabel>
                  <FormDescription>
                    Allow KeelAssistant to upload activity blocks to this
                    workspace. When off, the Mac app can still track locally but
                    sync will fail until you turn this on.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Enable activity tracking"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {!trackingEnabled && persisted?.tracking_enabled !== true ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Uploads from KeelAssistant are currently blocked for this
              workspace.
            </p>
          ) : null}
        </div>

        <div className="space-y-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Capture preferences
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Fine-tune what gets stored when blocks are uploaded.
            </p>
          </div>

          <FormField
            control={form.control}
            name="capture_full_urls"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <FormLabel>Store full URLs</FormLabel>
                  <FormDescription>
                    By default only the domain is saved. Enable this to store
                    complete URLs for browser activity (more sensitive).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!trackingEnabled}
                    aria-label="Store full URLs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="idle_threshold_seconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idle threshold (seconds)</FormLabel>
                <FormDescription>
                  How long you must be inactive before KeelAssistant ends an
                  activity block. Default is 120 seconds.
                </FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    min={30}
                    max={3600}
                    step={30}
                    disabled={!trackingEnabled}
                    className="max-w-[12rem] bg-[var(--workspace-control-surface)]"
                    {...field}
                    onChange={(event) =>
                      field.onChange(Number.parseInt(event.target.value, 10))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Exclusions
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Apps and domains listed here should not be tracked. One entry per
              line.
            </p>
          </div>

          <FormField
            control={form.control}
            name="excluded_apps_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excluded apps</FormLabel>
                <FormDescription>
                  Match by app name or bundle ID, e.g.{' '}
                  <span className="font-mono text-xs">1Password</span> or{' '}
                  <span className="font-mono text-xs">com.1password.1password</span>
                </FormDescription>
                <FormControl>
                  <Textarea
                    rows={4}
                    disabled={!trackingEnabled}
                    placeholder={'1Password\ncom.apple.SafariPrivateBrowsing'}
                    className="bg-[var(--workspace-control-surface)] font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="excluded_domains_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excluded domains</FormLabel>
                <FormDescription>
                  Browser tabs on these domains are skipped entirely.
                </FormDescription>
                <FormControl>
                  <Textarea
                    rows={4}
                    disabled={!trackingEnabled}
                    placeholder={'bank.example.com\nmail.google.com'}
                    className="bg-[var(--workspace-control-surface)] font-mono text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {isDirty ? (
              <span className="text-amber-200">Unsaved changes</span>
            ) : trackingEnabled ? (
              <span>Tracking enabled for this workspace</span>
            ) : (
              <span>Tracking disabled</span>
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
