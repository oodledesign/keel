'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type {
  CampaignAutomation,
  EmailCampaign,
} from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  deleteAutomationAction,
  saveAutomationAction,
} from '../_lib/server/server-actions';

export function CampaignAutomationsPanel({
  accountId,
  accountSlug,
  automations,
  campaigns,
}: {
  accountId: string;
  accountSlug: string;
  automations: CampaignAutomation[];
  campaigns: EmailCampaign[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('Welcome new subscribers');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');

  return (
    <div className="space-y-6">
      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>
          New-subscriber welcome
        </h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          When someone joins the mailing list for the first time, send the
          selected campaign as a one-off email. Included on every Campaigns
          plan, including Starter. Uses one send unit. Does not change the
          campaign’s blast status.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Campaign to send</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value="">Choose a campaign…</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          className={workspaceBtnPrimary}
          disabled={pending || !campaignId}
          onClick={() => {
            startTransition(async () => {
              try {
                await saveAutomationAction({
                  accountId,
                  accountSlug,
                  name,
                  campaignId,
                });
                toast.success('Automation created (paused). Turn it on below.');
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Could not create automation',
                );
              }
            });
          }}
        >
          Create automation
        </Button>
      </div>

      {automations.length === 0 ? (
        <p className={workspaceTextMuted}>No automations yet.</p>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className={`${workspacePanelCard} flex flex-wrap items-center justify-between gap-3 p-4`}
            >
              <div>
                <p className={`font-semibold ${workspaceText}`}>
                  {automation.name}
                </p>
                <p className={`text-sm ${workspaceTextMuted}`}>
                  Trigger: new subscriber · {automation.status}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await saveAutomationAction({
                          accountId,
                          accountSlug,
                          automationId: automation.id,
                          name: automation.name,
                          campaignId: automation.campaignId ?? campaignId,
                          status:
                            automation.status === 'active'
                              ? 'paused'
                              : 'active',
                        });
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Could not update',
                        );
                      }
                    });
                  }}
                >
                  {automation.status === 'active' ? 'Pause' : 'Turn on'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteAutomationAction({
                          accountId,
                          accountSlug,
                          automationId: automation.id,
                        });
                        toast.success('Automation deleted');
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Could not delete',
                        );
                      }
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
