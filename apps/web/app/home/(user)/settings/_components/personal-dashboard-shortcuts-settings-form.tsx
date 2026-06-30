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
  initialIncludeWorkspaceTasks: boolean;
  workspaceOptions: Array<{ slug: string; name: string }>;
};

export function PersonalDashboardShortcutsSettingsForm({
  initialShortcuts,
  initialMobileNavShortcuts,
  initialDefaultLanding,
  initialIncludeWorkspaceTasks,
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
  const [includeWorkspaceTasks, setIncludeWorkspaceTasks] = useState(
    initialIncludeWorkspaceTasks,
  );
  const [pending, startTransition] = useTransition();

  const saveAll = () => {
    startTransition(async () => {
      const [shortcutsRes, landingRes] = await Promise.all([
        savePersonalDashboardShortcutsAction(
          shortcuts,
          mobileNavShortcuts,
          includeWorkspaceTasks,
        ),
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
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">Default landing</h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Choose where Ozer opens after you sign in.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
              Open on sign-in
            </p>
            <Select
              value={landingType}
              onValueChange={(v) =>
                setLandingType(v as DefaultLandingPreference['type'])
              }
            >
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                <SelectItem value="personal">Personal home</SelectItem>
                <SelectItem value="workspace">A workspace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {landingType === 'workspace' ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
                Workspace
              </p>
              <Select value={workspaceSlug || 'none'} onValueChange={setWorkspaceSlug}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Choose workspace" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
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

      <section className="space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-8">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Unified task view
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Your personal home can show tasks from every workspace in one list —
            or keep work tasks inside each workspace only.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3">
          <input
            type="checkbox"
            checked={includeWorkspaceTasks}
            onChange={(e) => setIncludeWorkspaceTasks(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[color:var(--workspace-shell-border)] bg-transparent accent-[var(--ozer-accent)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
              Show tasks from all workspaces on personal home
            </span>
            <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
              When on, Today&apos;s Focus, Upcoming, and the Tasks page include
              work linked to your team workspaces. When off, only personal life
              areas appear there — workspace tasks stay in each workspace.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-8">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Personal dashboard shortcuts
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
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

      <section className="space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-8">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Mobile bottom navigation
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
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
        className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
        disabled={pending}
        onClick={saveAll}
      >
        {pending ? 'Saving…' : 'Save dashboard preferences'}
      </Button>
    </div>
  );
}
