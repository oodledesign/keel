'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { describeWelcomeAutomationScope } from '~/lib/campaigns/campaign-automation-scope';
import type {
  CampaignAudienceList,
  CampaignAutomation,
  CampaignAutomationScopeOption,
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

const selectClassName =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm';

export function CampaignAutomationsPanel({
  accountId,
  accountSlug,
  automations,
  campaigns,
  mailingForms,
  lists,
}: {
  accountId: string;
  accountSlug: string;
  automations: CampaignAutomation[];
  campaigns: EmailCampaign[];
  mailingForms: CampaignAutomationScopeOption[];
  lists: CampaignAudienceList[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('Welcome new subscribers');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [formId, setFormId] = useState('');
  const [audienceListId, setAudienceListId] = useState('');

  return (
    <div className="space-y-6">
      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>
          New-subscriber welcome
        </h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          When someone joins via a mailing-list form, send the selected campaign
          as a one-off email. Workspace-wide automations fire on first subscribe
          only. Form- or list-scoped automations can still fire later, the first
          time that form or list is used. If both a global and a scoped
          automation match, both send. Included on every Campaigns plan,
          including Starter. Uses one send unit. Does not change the campaign’s
          blast status.
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
              className={selectClassName}
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
          <div className="space-y-2">
            <Label>Form scope</Label>
            <select
              data-test="automation-form-scope"
              className={selectClassName}
              value={formId}
              onChange={(event) => setFormId(event.target.value)}
            >
              <option value="">Any mailing list (workspace)</option>
              {mailingForms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Audience list scope</Label>
            <select
              data-test="automation-list-scope"
              className={selectClassName}
              value={audienceListId}
              onChange={(event) => setAudienceListId(event.target.value)}
            >
              <option value="">Any audience list</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className={`text-xs ${workspaceTextMuted}`}>
          Leave both scopes empty for every first-time workspace subscriber. Set
          a form and/or list to send only when that signup matches. Leave both
          empty, or set one or both — matching uses OR.
        </p>
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
                  formId: formId || null,
                  audienceListId: audienceListId || null,
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
          {automations.map((automation) => {
            const formName = mailingForms.find(
              (form) => form.id === automation.formId,
            )?.name;
            const listName = lists.find(
              (list) => list.id === automation.audienceListId,
            )?.name;

            return (
              <div
                key={automation.id}
                className={`${workspacePanelCard} flex flex-wrap items-center justify-between gap-3 p-4`}
              >
                <div>
                  <p className={`font-semibold ${workspaceText}`}>
                    {automation.name}
                  </p>
                  <p className={`text-sm ${workspaceTextMuted}`}>
                    Trigger: new subscriber ·{' '}
                    {describeWelcomeAutomationScope({
                      formId: automation.formId,
                      audienceListId: automation.audienceListId,
                      formName,
                      listName,
                    })}{' '}
                    · {automation.status}
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
                            formId: automation.formId,
                            audienceListId: automation.audienceListId,
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
            );
          })}
        </div>
      )}
    </div>
  );
}
