'use client';

import { useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { DashboardShortcutsEditor } from '~/components/dashboard-shortcuts/dashboard-shortcuts-editor';
import {
  saveDefaultLandingAction,
  savePersonalDashboardShortcutsAction,
} from '~/lib/dashboard-shortcuts/dashboard-shortcuts.actions';
import type {
  DefaultLandingPreference,
  StoredShortcut,
} from '~/lib/dashboard-shortcuts/types';

type Props = {
  initialShortcuts: StoredShortcut[];
  initialMobileNavShortcuts: StoredShortcut[];
  initialDefaultLanding: DefaultLandingPreference;
  workspaceOptions: Array<{ slug: string; name: string }>;
};

export function PersonalDashboardShortcutsSettingsForm({
  initialShortcuts,
  initialMobileNavShortcuts,
  initialDefaultLanding,
  workspaceOptions,
}: Props) {
  const [shortcuts, setShortcuts] = useState(initialShortcuts);
  const [mobileNavShortcuts, setMobileNavShortcuts] = useState(
    initialMobileNavShortcuts,
  );
  const [landingType, setLandingType] = useState(initialDefaultLanding.type);
  const [workspaceSlug, setWorkspaceSlug] = useState(
    initialDefaultLanding.workspaceSlug ?? '',
  );
  const [pending, startTransition] = useTransition();

  const saveAll = () => {
    startTransition(async () => {
      const [shortcutsRes, landingRes] = await Promise.all([
        savePersonalDashboardShortcutsAction(shortcuts, mobileNavShortcuts),
        saveDefaultLandingAction({
          type: landingType,
          workspaceSlug: landingType === 'workspace' ? workspaceSlug : null,
        }),
      ]);

      if (!shortcutsRes.success) {
        toast.error(shortcutsRes.error ?? 'Could not save shortcuts');
        return;
      }
      if (!landingRes.success) {
        toast.error(landingRes.error ?? 'Could not save default landing');
        return;
      }

      toast.success('Dashboard preferences saved');
    });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Default landing</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Choose where Keel opens after you sign in.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Open on sign-in
            </p>
            <Select
              value={landingType}
              onValueChange={(v) =>
                setLandingType(v as DefaultLandingPreference['type'])
              }
            >
              <SelectTrigger className="border-white/10 bg-[var(--workspace-shell-panel)] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0F1B35] text-white">
                <SelectItem value="personal">Personal home</SelectItem>
                <SelectItem value="workspace">A workspace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {landingType === 'workspace' ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Workspace
              </p>
              <Select value={workspaceSlug || 'none'} onValueChange={setWorkspaceSlug}>
                <SelectTrigger className="border-white/10 bg-[var(--workspace-shell-panel)] text-white">
                  <SelectValue placeholder="Choose workspace" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0F1B35] text-white">
                  {workspaceOptions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No workspaces available
                    </SelectItem>
                  ) : (
                    workspaceOptions.map((ws) => (
                      <SelectItem key={ws.slug} value={ws.slug}>
                        {ws.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 border-t border-white/10 pt-8">
        <div>
          <h2 className="text-base font-semibold text-white">
            Personal dashboard shortcuts
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Quick links at the top of your personal home — including pages in any
            workspace you can access, like finances or Rankly.
          </p>
        </div>

        <DashboardShortcutsEditor
          scope="personal"
          shortcuts={shortcuts}
          onChange={setShortcuts}
        />
      </section>

      <section className="space-y-4 border-t border-white/10 pt-8">
        <div>
          <h2 className="text-base font-semibold text-white">
            Mobile bottom navigation
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Choose up to three icon shortcuts beside Home and Menu on your phone.
            Leave empty for Home and Menu only.
          </p>
        </div>

        <DashboardShortcutsEditor
          scope="personal"
          shortcuts={mobileNavShortcuts}
          onChange={setMobileNavShortcuts}
          maxShortcuts={3}
          helperText="Pick up to 3 pages for the floating bar on mobile."
          emptyText="No mobile shortcuts — only Home and Menu will show."
        />
      </section>

      <Button
        className="bg-[var(--keel-teal)] hover:bg-[#238b7f]"
        disabled={pending}
        onClick={saveAll}
      >
        {pending ? 'Saving…' : 'Save dashboard preferences'}
      </Button>
    </div>
  );
}
