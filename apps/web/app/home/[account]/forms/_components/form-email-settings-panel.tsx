'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';

import { WorkspaceRichTextEditor } from '~/components/workspace-rich-text';
import {
  type FormNotifyMemberOption,
  MAX_FORM_NOTIFY_EMAILS,
  type WorkspaceFormEmailRule,
  type WorkspaceFormEmailSettings,
  type WorkspaceFormEmailTemplate,
  createEmptyFormEmailRule,
  createEmptyFormEmailTemplate,
} from '~/lib/workspace-forms/form-email';
import type { WorkspaceFormField } from '~/lib/workspace-forms/form-fields';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

type Props = {
  settings: WorkspaceFormEmailSettings;
  fields: WorkspaceFormField[];
  members: FormNotifyMemberOption[];
  onChange: (settings: WorkspaceFormEmailSettings) => void;
};

const ALWAYS = '__always__';

export function FormEmailSettingsPanel({
  settings,
  fields,
  members,
  onChange,
}: Props) {
  const optionFields = fields.filter(
    (field) => field.options && field.options.length > 0,
  );

  function updateTemplate(
    id: string,
    patch: Partial<WorkspaceFormEmailTemplate>,
  ) {
    onChange({
      ...settings,
      templates: settings.templates.map((template) =>
        template.id === id ? { ...template, ...patch } : template,
      ),
    });
  }

  function updateRule(id: string, patch: Partial<WorkspaceFormEmailRule>) {
    onChange({
      ...settings,
      rules: settings.rules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    });
  }

  function addTemplate() {
    const template = createEmptyFormEmailTemplate(settings.templates);
    onChange({
      ...settings,
      templates: [...settings.templates, template],
    });
  }

  function addRule(kind: WorkspaceFormEmailRule['kind']) {
    const templateId = settings.templates[0]?.id;
    if (!templateId) {
      const template = createEmptyFormEmailTemplate(settings.templates);
      onChange({
        ...settings,
        templates: [template],
        rules: [
          ...settings.rules,
          createEmptyFormEmailRule(kind, settings.rules, template.id),
        ],
      });
      return;
    }
    onChange({
      ...settings,
      rules: [
        ...settings.rules,
        createEmptyFormEmailRule(kind, settings.rules, templateId),
      ],
    });
  }

  const extraEmailsText = settings.notifyEmails.join('\n');

  return (
    <section className={`${workspacePanelCard} space-y-5 p-5`}>
      <div>
        <h2 className={`text-base font-semibold ${workspaceText}`}>Emails</h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          After someone submits, send an auto-reply to them and/or notify your
          team. Rules run top to bottom — first match wins (else-if).
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className={`text-sm font-medium ${workspaceText}`}>Templates</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addTemplate}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add template
          </Button>
        </div>
        {settings.templates.length === 0 ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            No templates yet. RSVP forms start with Yes / No replies.
          </p>
        ) : null}
        {settings.templates.map((template) => (
          <div
            key={template.id}
            className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  value={template.name}
                  onChange={(event) =>
                    updateTemplate(template.id, { name: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Subject</Label>
                <Input
                  value={template.subject}
                  onChange={(event) =>
                    updateTemplate(template.id, { subject: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Body</Label>
              <WorkspaceRichTextEditor
                value={template.bodyHtml}
                onChange={(html) =>
                  updateTemplate(template.id, { bodyHtml: html })
                }
                placeholder="Use {{name}}, {{email}}, {{event_name}}, {{event_address}}, or any field key."
                minHeight={100}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...settings,
                  templates: settings.templates.filter(
                    (item) => item.id !== template.id,
                  ),
                  rules: settings.rules.filter(
                    (rule) => rule.templateId !== template.id,
                  ),
                })
              }
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove template
            </Button>
          </div>
        ))}
      </div>

      <RuleList
        title="Auto-replies to the submitter"
        kind="autoresponder"
        rules={settings.rules}
        templates={settings.templates}
        optionFields={optionFields}
        onAdd={() => addRule('autoresponder')}
        onChange={updateRule}
        onRemove={(id) =>
          onChange({
            ...settings,
            rules: settings.rules.filter((rule) => rule.id !== id),
          })
        }
      />

      <RuleList
        title="Notifications to the team"
        kind="notification"
        rules={settings.rules}
        templates={settings.templates}
        optionFields={optionFields}
        onAdd={() => addRule('notification')}
        onChange={updateRule}
        onRemove={(id) =>
          onChange({
            ...settings,
            rules: settings.rules.filter((rule) => rule.id !== id),
          })
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Notify workspace members</Label>
          <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
            {members.length === 0 ? (
              <p className={`text-sm ${workspaceTextMuted}`}>
                No members with an email on this workspace.
              </p>
            ) : (
              members.map((member) => {
                const checked = settings.notifyMemberIds.includes(
                  member.userId,
                );
                return (
                  <label
                    key={member.userId}
                    className={`flex items-start gap-2 text-sm ${workspaceText}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...settings.notifyMemberIds, member.userId]
                          : settings.notifyMemberIds.filter(
                              (id) => id !== member.userId,
                            );
                        onChange({ ...settings, notifyMemberIds: next });
                      }}
                    />
                    <span>
                      {member.name}
                      <span className={`block text-xs ${workspaceTextMuted}`}>
                        {member.email}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>
            Extra notification addresses (max {MAX_FORM_NOTIFY_EMAILS})
          </Label>
          <textarea
            rows={6}
            className="border-input min-h-[120px] rounded-md border bg-transparent px-3 py-2 text-sm"
            value={extraEmailsText}
            placeholder={'one@example.com\ntwo@example.com'}
            onChange={(event) => {
              const emails = event.target.value
                .split(/[\n,]+/)
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, MAX_FORM_NOTIFY_EMAILS);
              onChange({ ...settings, notifyEmails: emails });
            }}
          />
          <p className={`text-xs ${workspaceTextMuted}`}>
            One email per line. These are not form questions.
          </p>
        </div>
      </div>
    </section>
  );
}

function RuleList({
  title,
  kind,
  rules,
  templates,
  optionFields,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  kind: WorkspaceFormEmailRule['kind'];
  rules: WorkspaceFormEmailRule[];
  templates: WorkspaceFormEmailTemplate[];
  optionFields: WorkspaceFormField[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<WorkspaceFormEmailRule>) => void;
  onRemove: (id: string) => void;
}) {
  const visible = rules
    .filter((rule) => rule.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-sm font-medium ${workspaceText}`}>{title}</h3>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add rule
        </Button>
      </div>
      {visible.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No rules. Add one to send this kind of email.
        </p>
      ) : null}
      {visible.map((rule, index) => {
        const selectedField = optionFields.find(
          (field) => field.key === rule.fieldKey,
        );
        return (
          <div
            key={rule.id}
            className="grid gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 md:grid-cols-[auto_1fr_1fr_1fr_auto]"
          >
            <label
              className={`flex items-center gap-2 text-sm ${workspaceText}`}
            >
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) =>
                  onChange(rule.id, { enabled: checked })
                }
              />
              <span className={workspaceTextMuted}>
                {index === 0 ? 'If' : 'Else if'}
              </span>
            </label>
            <Select
              value={rule.fieldKey ?? ALWAYS}
              onValueChange={(value) =>
                onChange(rule.id, {
                  fieldKey: value === ALWAYS ? null : value,
                  equals: value === ALWAYS ? null : rule.equals,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Always" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALWAYS}>Always</SelectItem>
                {optionFields.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={rule.equals ?? ALWAYS}
              disabled={!rule.fieldKey}
              onValueChange={(value) =>
                onChange(rule.id, {
                  equals: value === ALWAYS ? null : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALWAYS}>Any value</SelectItem>
                {(selectedField?.options ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    equals {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={rule.templateId}
              onValueChange={(value) =>
                onChange(rule.id, { templateId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove rule"
              onClick={() => onRemove(rule.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
