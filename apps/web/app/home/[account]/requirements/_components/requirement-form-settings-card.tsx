'use client';

import { useEffect, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  getRequirementFormSettings,
  updateRequirementFormSettings,
} from '../../listings/_lib/server/circulation-actions';
import pathsConfig from '~/config/paths.config';
import { workspacePanelCard } from '~/lib/workspace-ui';

type Props = {
  accountId: string;
};

export function RequirementFormSettingsCard({ accountId }: Props) {
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('Register your requirement');
  const [intro, setIntro] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    getRequirementFormSettings({ accountId })
      .then((row) => {
        const r = row as Record<string, unknown>;
        setToken(String(r.share_token ?? ''));
        setEnabled(Boolean(r.enabled));
        setTitle(String(r.title ?? 'Register your requirement'));
        setIntro(String(r.intro ?? ''));
        setPrivacyPolicyUrl(String(r.privacy_policy_url ?? ''));
        setSuccessMessage(String(r.success_message ?? ''));
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Could not load form settings',
        );
      });
  }, [accountId]);

  const publicPath = token
    ? pathsConfig.app.requirementFormShare.replace('[token]', token)
    : '';
  const publicUrl =
    typeof window !== 'undefined' && publicPath
      ? `${window.location.origin}${publicPath}`
      : publicPath;

  const embedSnippet = publicUrl
    ? `<iframe src="${publicUrl}" title="Requirement form" style="width:100%;min-height:720px;border:0;"></iframe>`
    : '';

  function save() {
    startTransition(async () => {
      try {
        await updateRequirementFormSettings({
          accountId,
          enabled,
          title,
          intro: intro || null,
          privacyPolicyUrl: privacyPolicyUrl || null,
          successMessage: successMessage || null,
        });
        toast.success('Requirement form saved');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Website requirement form
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--workspace-shell-text)]">
              Public embed
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Multi-step form that creates or updates requirements and marketing
              preferences.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid gap-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Intro</Label>
          <Textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={2}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Privacy policy URL</Label>
          <Input
            type="url"
            value={privacyPolicyUrl}
            onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
            placeholder="https://agency.co.uk/privacy"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Success message</Label>
          <Input
            value={successMessage}
            onChange={(e) => setSuccessMessage(e.target.value)}
          />
        </div>

        {publicUrl ? (
          <div className="space-y-2">
            <Label>Public URL</Label>
            <code className="block truncate rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5 text-xs">
              {publicUrl}
            </code>
            <Label>Embed snippet</Label>
            <Textarea readOnly value={embedSnippet} rows={3} className="font-mono text-xs" />
          </div>
        ) : null}

        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save form'}
        </Button>
      </CardContent>
    </Card>
  );
}
