'use client';

import { useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import type { CommercialBoardSettings } from '~/lib/commercial/board-company-settings';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import { saveBoardCompanySettingsAction } from '../_lib/server/server-actions';

type BranchOption = {
  id: string;
  name: string;
};

export function BoardCompanySettingsCard({
  accountId,
  initialSettings,
  branches,
}: {
  accountId: string;
  initialSettings: CommercialBoardSettings;
  branches: BranchOption[];
}) {
  const [email, setEmail] = useState(initialSettings.email);
  const [cc, setCc] = useState(initialSettings.cc);
  const [subjectTemplate, setSubjectTemplate] = useState(
    initialSettings.subjectTemplate,
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    initialSettings.bodyTemplate,
  );
  const [byBranch, setByBranch] = useState(initialSettings.byBranch);
  const [pending, startTransition] = useTransition();

  const showBranchOverrides = branches.length > 1;

  const save = () => {
    startTransition(async () => {
      try {
        const saved = await saveBoardCompanySettingsAction({
          accountId,
          email,
          cc,
          subjectTemplate,
          bodyTemplate,
          byBranch,
        });
        setEmail(saved.email);
        setCc(saved.cc);
        setSubjectTemplate(saved.subjectTemplate);
        setBodyTemplate(saved.bodyTemplate);
        setByBranch(saved.byBranch);
        toast.success('Board company settings saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  };

  return (
    <Card id="board-company" className={workspacePanelCard}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Boards
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          When a disposal moves to Under offer, Let, or Sold, agents confirm
          before a boards email is sent. The saved address is prefilled; extra
          addresses can be added on the prompt. Merge fields:{' '}
          <code className="text-xs">{'{{property_address}}'}</code>,{' '}
          <code className="text-xs">{'{{status}}'}</code>,{' '}
          <code className="text-xs">{'{{listing_ref}}'}</code>,{' '}
          <code className="text-xs">{'{{branch_name}}'}</code>,{' '}
          <code className="text-xs">{'{{agent_name}}'}</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Board company email
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="boards@supplier.example"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              CC (optional)
            </Label>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="office@agency.example"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Subject template
          </Label>
          <Input
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Email body template
          </Label>
          <Textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={8}
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] font-mono text-sm"
          />
        </div>

        {showBranchOverrides ? (
          <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Per-branch overrides (optional)
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Leave blank to use the workspace board company email above. The
              disposal’s branch name is always used in merge fields.
            </p>
            {branches.map((branch) => {
              const override = byBranch[branch.id] ?? { email: '', cc: '' };
              return (
                <div
                  key={branch.id}
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_1fr_1fr]"
                >
                  <p className="self-end text-sm text-[var(--workspace-shell-text)]">
                    {branch.name}
                  </p>
                  <Input
                    type="email"
                    value={override.email}
                    placeholder="Branch email"
                    onChange={(e) =>
                      setByBranch((prev) => ({
                        ...prev,
                        [branch.id]: {
                          email: e.target.value,
                          cc: prev[branch.id]?.cc ?? '',
                        },
                      }))
                    }
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                  />
                  <Input
                    value={override.cc}
                    placeholder="Branch CC"
                    onChange={(e) =>
                      setByBranch((prev) => ({
                        ...prev,
                        [branch.id]: {
                          email: prev[branch.id]?.email ?? '',
                          cc: e.target.value,
                        },
                      }))
                    }
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={pending}
            className={workspaceBtnPrimaryMd}
            onClick={save}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save boards settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
