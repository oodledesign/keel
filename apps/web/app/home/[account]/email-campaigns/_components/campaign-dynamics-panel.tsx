'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import type { DynamicsConnectionPublic } from '~/lib/dynamics/types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  disconnectDynamicsConnectionAction,
  retryDynamicsSyncJobsAction,
  saveDynamicsConnectionAction,
  testDynamicsConnectionAction,
} from '../_lib/server/dynamics-actions';

function consentFieldsInput(fields: string[]): string {
  return fields.join(', ');
}

function parseConsentFields(value: string): string[] {
  return value
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
}

export function CampaignDynamicsPanel({
  accountId,
  accountSlug,
  connection,
  canEdit,
  inboundNote,
}: {
  accountId: string;
  accountSlug: string;
  connection: DynamicsConnectionPublic;
  canEdit: boolean;
  inboundNote: string;
}) {
  const [pending, startTransition] = useTransition();
  const [syncEnabled, setSyncEnabled] = useState(connection.syncEnabled);
  const [tenantId, setTenantId] = useState(connection.tenantId);
  const [environmentUrl, setEnvironmentUrl] = useState(
    connection.environmentUrl,
  );
  const [applicationId, setApplicationId] = useState(connection.applicationId);
  const [clientSecret, setClientSecret] = useState('');
  const [entity, setEntity] = useState(connection.entity);
  const [emailField, setEmailField] = useState(connection.fieldMapping.email);
  const [firstNameField, setFirstNameField] = useState(
    connection.fieldMapping.firstName,
  );
  const [lastNameField, setLastNameField] = useState(
    connection.fieldMapping.lastName,
  );
  const [companyField, setCompanyField] = useState(
    connection.fieldMapping.company ?? '',
  );
  const [companyStrategy, setCompanyStrategy] = useState(
    connection.fieldMapping.companyStrategy,
  );
  const [consentMode, setConsentMode] = useState(
    connection.fieldMapping.consentMode,
  );
  const [consentFields, setConsentFields] = useState(
    consentFieldsInput(connection.fieldMapping.consentFields),
  );
  const [extraConsentField, setExtraConsentField] = useState(
    connection.fieldMapping.extraConsentField ?? '',
  );

  const fieldMapping = {
    email: emailField,
    firstName: firstNameField,
    lastName: lastNameField,
    company: companyField.trim() || null,
    companyStrategy,
    consentMode,
    consentFields: parseConsentFields(consentFields),
    extraConsentField: extraConsentField.trim() || null,
  };

  const handleSave = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await saveDynamicsConnectionAction({
          accountId,
          accountSlug,
          syncEnabled,
          tenantId,
          environmentUrl,
          applicationId,
          clientSecret: clientSecret.trim() || null,
          entity,
          fieldMapping,
        });
        setClientSecret('');
        toast.success('Dynamics connection saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save Dynamics',
        );
      }
    });
  };

  const handleTest = () => {
    startTransition(async () => {
      try {
        const result = await testDynamicsConnectionAction({
          accountId,
          accountSlug,
        });
        toast.success(
          `Connected to Dataverse organisation ${result.organizationId}`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Connection test failed',
        );
      }
    });
  };

  const handleRetry = () => {
    startTransition(async () => {
      try {
        const result = await retryDynamicsSyncJobsAction({
          accountId,
          accountSlug,
        });
        toast.success(
          `Retried ${result.reset} job${result.reset === 1 ? '' : 's'} — ${result.succeeded} succeeded`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not retry sync jobs',
        );
      }
    });
  };

  const handleDisconnect = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await disconnectDynamicsConnectionAction({ accountId, accountSlug });
        setClientSecret('');
        toast.success('Dynamics disconnected');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not disconnect',
        );
      }
    });
  };

  return (
    <div className="space-y-6" data-test="campaigns-dynamics-panel">
      <div className={`${workspacePanelCard} space-y-4 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`font-semibold ${workspaceText}`}>
              Microsoft Dynamics 365
            </h2>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Ozer keeps the mailing list. On subscribe we upsert a Dataverse
              Contact (or Lead) and write marketing-consent flags. Dynamics
              downtime never blocks the public form.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={syncEnabled}
              disabled={!canEdit || pending}
              onCheckedChange={setSyncEnabled}
            />
            <span className={workspaceText}>Enable sync</span>
          </label>
        </div>

        {!connection.canEncryptSecrets ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Set <code>TOKEN_ENCRYPTION_KEY</code> on the web app before storing
            the Azure client secret.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dynamics-tenant">Directory (tenant) ID</Label>
            <Input
              id="dynamics-tenant"
              value={tenantId}
              disabled={!canEdit}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onChange={(event) => setTenantId(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dynamics-app">Application (client) ID</Label>
            <Input
              id="dynamics-app"
              value={applicationId}
              disabled={!canEdit}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onChange={(event) => setApplicationId(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dynamics-env">Environment URL</Label>
            <Input
              id="dynamics-env"
              value={environmentUrl}
              disabled={!canEdit}
              placeholder="https://org.crm11.dynamics.com"
              onChange={(event) => setEnvironmentUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dynamics-secret">Client secret</Label>
            <Input
              id="dynamics-secret"
              type="password"
              autoComplete="new-password"
              value={clientSecret}
              disabled={!canEdit}
              placeholder={
                connection.hasClientSecret
                  ? 'Saved — paste a new secret to rotate'
                  : 'Paste the Azure client secret value'
              }
              onChange={(event) => setClientSecret(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={`${workspacePanelCard} space-y-4 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>Field mapping</h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          Defaults match Dataverse Sales Contact. Change logical names if
          Arcanum uses custom attributes. Consent defaults to inverted{' '}
          <code>donotemail</code> / <code>donotbulkemail</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dynamics-entity">Create / update</Label>
            <select
              id="dynamics-entity"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={entity}
              disabled={!canEdit}
              onChange={(event) =>
                setEntity(event.target.value === 'lead' ? 'lead' : 'contact')
              }
            >
              <option value="contact">Contact</option>
              <option value="lead">Lead</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dynamics-company-strategy">Company</Label>
            <select
              id="dynamics-company-strategy"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={companyStrategy}
              disabled={!canEdit}
              onChange={(event) =>
                setCompanyStrategy(event.target.value as typeof companyStrategy)
              }
            >
              <option value="account_lookup">
                Find / create Account and link
              </option>
              <option value="contact_field">Write a text field</option>
              <option value="none">Do not send company</option>
            </select>
          </div>
          <MappedField
            id="dynamics-email-field"
            label="Email field"
            value={emailField}
            disabled={!canEdit}
            onChange={setEmailField}
          />
          <MappedField
            id="dynamics-first-field"
            label="First name field"
            value={firstNameField}
            disabled={!canEdit}
            onChange={setFirstNameField}
          />
          <MappedField
            id="dynamics-last-field"
            label="Last name field"
            value={lastNameField}
            disabled={!canEdit}
            onChange={setLastNameField}
          />
          <MappedField
            id="dynamics-company-field"
            label="Company field (if text)"
            value={companyField}
            disabled={!canEdit || companyStrategy !== 'contact_field'}
            onChange={setCompanyField}
            placeholder="companyname"
          />
          <div className="space-y-2">
            <Label htmlFor="dynamics-consent-mode">Consent mapping</Label>
            <select
              id="dynamics-consent-mode"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={consentMode}
              disabled={!canEdit}
              onChange={(event) =>
                setConsentMode(event.target.value as typeof consentMode)
              }
            >
              <option value="donotemail_inverted">
                Invert donotemail flags
              </option>
              <option value="boolean_opt_in">Boolean opted-in = true</option>
            </select>
          </div>
          <MappedField
            id="dynamics-consent-fields"
            label="Consent fields"
            value={consentFields}
            disabled={!canEdit}
            onChange={setConsentFields}
            placeholder="donotemail, donotbulkemail"
          />
          <MappedField
            id="dynamics-extra-consent"
            label="Extra consent field (optional)"
            value={extraConsentField}
            disabled={!canEdit}
            onChange={setExtraConsentField}
            placeholder="new_ozerconsent"
          />
        </div>
      </div>

      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>Status</h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          {connection.connected
            ? 'Credentials are stored for this workspace.'
            : 'Not connected yet.'}{' '}
          Pending jobs: {connection.pendingJobCount}. Failed:{' '}
          {connection.failedJobCount}.
        </p>
        {connection.lastTestedAt ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Last test {new Date(connection.lastTestedAt).toLocaleString()}
            {connection.lastTestError
              ? ` — ${connection.lastTestError}`
              : ' — ok'}
          </p>
        ) : null}
        {connection.lastSyncAt ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Last sync {new Date(connection.lastSyncAt).toLocaleString()}
            {connection.lastSyncError
              ? ` — ${connection.lastSyncError}`
              : ' — ok'}
          </p>
        ) : null}
        <p className={`text-sm ${workspaceTextMuted}`}>{inboundNote}</p>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={workspaceBtnPrimary}
            disabled={pending}
            onClick={handleSave}
          >
            Save connection
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !connection.hasClientSecret}
            onClick={handleTest}
          >
            Test connection
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || connection.failedJobCount === 0}
            onClick={handleRetry}
          >
            Retry failed jobs
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || !connection.connected}
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <p className={`text-sm ${workspaceTextMuted}`}>
          Owners and admins can connect Dynamics for this workspace.
        </p>
      )}
    </div>
  );
}

function MappedField({
  id,
  label,
  value,
  disabled,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
