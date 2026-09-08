'use client';

import { useState } from 'react';

import { Plus, Trash2 } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kit/ui/accordion';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
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
import { Textarea } from '@kit/ui/textarea';

import { WorkspaceRichTextEditor } from '~/components/workspace-rich-text';
import {
  type FormEmailMergeToken,
  type FormNotifyMemberOption,
  MAX_FORM_NOTIFY_EMAILS,
  WORKSPACE_FORM_EMAIL_KINDS,
  type WorkspaceFormEmailKind,
  type WorkspaceFormEmailRule,
  type WorkspaceFormEmailSettings,
  type WorkspaceFormEmailTemplate,
  createEmptyFormEmailRule,
  createEmptyFormEmailTemplate,
  insertFormEmailMergeToken,
  listFormEmailMergeTokens,
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

const TEMPLATE_KIND_LABELS: Record<WorkspaceFormEmailKind, string> = {
  autoresponder: 'Auto-reply',
  notification: 'Team notification',
};

export function FormEmailSettingsPanel({
  settings,
  fields,
  members,
  onChange,
}: Props) {
  const [openTemplateId, setOpenTemplateId] = useState<string | undefined>(
    () =>
      settings.templates.length === 1 ? settings.templates[0]?.id : undefined,
  );

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
    setOpenTemplateId(template.id);
  }

  function addRule(kind: WorkspaceFormEmailRule['kind']) {
    const templateId = settings.templates[0]?.id;
    if (!templateId) {
      const template = createEmptyFormEmailTemplate(settings.templates, kind);
      onChange({
        ...settings,
        templates: [template],
        rules: [
          ...settings.rules,
          createEmptyFormEmailRule(kind, settings.rules, template.id),
        ],
      });
      setOpenTemplateId(template.id);
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
  const mergeTokens = listFormEmailMergeTokens(fields);

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
        ) : (
          <Accordion
            type="single"
            collapsible
            value={openTemplateId ?? ''}
            onValueChange={(value) => setOpenTemplateId(value || undefined)}
            className="space-y-3"
          >
            {settings.templates.map((template) => (
              <AccordionItem
                key={template.id}
                value={template.id}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] px-0"
                data-test={`form-email-template-${template.id}`}
              >
                <AccordionTrigger
                  className={`px-4 py-3 hover:no-underline ${workspaceText}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3 pr-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {template.name.trim() || 'Untitled template'}
                      </span>
                      {template.subject.trim() ? (
                        <span
                          className={`mt-0.5 block truncate text-xs font-normal ${workspaceTextMuted}`}
                        >
                          {template.subject}
                        </span>
                      ) : null}
                    </span>
                    <TemplateKindBadges
                      kinds={templateKindsFor(settings.rules, template.id)}
                    />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 px-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`form-email-tpl-name-${template.id}`}>
                        Name
                      </Label>
                      <Input
                        id={`form-email-tpl-name-${template.id}`}
                        value={template.name}
                        onChange={(event) =>
                          updateTemplate(template.id, {
                            name: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`form-email-tpl-subject-${template.id}`}>
                        Subject
                      </Label>
                      <Input
                        id={`form-email-tpl-subject-${template.id}`}
                        value={template.subject}
                        onChange={(event) =>
                          updateTemplate(template.id, {
                            subject: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <FormMergeTokenChips
                    tokens={mergeTokens}
                    onInsertSubject={(token) =>
                      updateTemplate(template.id, {
                        subject: appendPlainToken(template.subject, token),
                      })
                    }
                    onInsertBody={(token) =>
                      updateTemplate(template.id, {
                        bodyHtml: insertFormEmailMergeToken(
                          template.bodyHtml,
                          token,
                        ),
                      })
                    }
                  />
                  <div className="grid gap-1.5">
                    <Label>Body</Label>
                    <WorkspaceRichTextEditor
                      value={template.bodyHtml}
                      onChange={(html) =>
                        updateTemplate(template.id, { bodyHtml: html })
                      }
                      placeholder="Use merge tokens such as {{name}}, {{form_name}}, or {{field_key}}."
                      minHeight={100}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const remaining = settings.templates.filter(
                        (item) => item.id !== template.id,
                      );
                      setOpenTemplateId(
                        remaining.length === 1
                          ? remaining[0]?.id
                          : openTemplateId === template.id
                            ? undefined
                            : openTemplateId,
                      );
                      onChange({
                        ...settings,
                        templates: remaining,
                        rules: settings.rules.filter(
                          (rule) => rule.templateId !== template.id,
                        ),
                      });
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove template
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
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

      <label
        className={`flex items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 text-sm ${workspaceText}`}
      >
        <Switch
          checked={settings.includeSubmittedAnswers !== false}
          onCheckedChange={(checked) =>
            onChange({ ...settings, includeSubmittedAnswers: checked })
          }
        />
        <span>
          <span className="font-medium">Include submitted answers</span>
          <span className={`mt-0.5 block text-xs ${workspaceTextMuted}`}>
            Team notification emails append every question and answer. Turn this
            off if you only want the custom template — you can still insert{' '}
            {'{{answers}}'} yourself.
          </span>
        </span>
      </label>

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
                    <Checkbox
                      className="mt-1"
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        const next =
                          nextChecked === true
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
          <Label htmlFor="form-email-notify-extra">
            Extra notification addresses (max {MAX_FORM_NOTIFY_EMAILS})
          </Label>
          <Textarea
            id="form-email-notify-extra"
            rows={6}
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

function templateKindsFor(
  rules: WorkspaceFormEmailRule[],
  templateId: string,
): WorkspaceFormEmailKind[] {
  const kinds = new Set<WorkspaceFormEmailKind>();
  for (const rule of rules) {
    if (rule.templateId === templateId) {
      kinds.add(rule.kind);
    }
  }
  return WORKSPACE_FORM_EMAIL_KINDS.filter((kind) => kinds.has(kind));
}

function TemplateKindBadges({ kinds }: { kinds: WorkspaceFormEmailKind[] }) {
  const labels =
    kinds.length > 0
      ? kinds.map((kind) => TEMPLATE_KIND_LABELS[kind])
      : ['Unused'];

  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className={`rounded-md border border-[color:var(--workspace-shell-border)] px-1.5 py-0.5 text-[11px] font-medium ${workspaceTextMuted}`}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

function appendPlainToken(value: string, token: string): string {
  const trimmed = value.trimEnd();
  if (!trimmed) return token;
  if (trimmed.includes(token)) return trimmed;
  return `${trimmed} ${token}`;
}

function FormMergeTokenChips({
  tokens,
  onInsertSubject,
  onInsertBody,
}: {
  tokens: FormEmailMergeToken[];
  onInsertSubject: (token: string) => void;
  onInsertBody: (token: string) => void;
}) {
  const [target, setTarget] = useState<'subject' | 'body'>('body');
  const builtins = tokens.filter((token) => token.group === 'builtin');
  const fields = tokens.filter((token) => token.group === 'field');

  function insert(token: string) {
    if (target === 'subject') {
      onInsertSubject(token);
      return;
    }
    onInsertBody(token);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs ${workspaceTextMuted}`}>
          Merge tokens — same {'{{field_key}}'} convention as auto-replies.
          Field keys also accept {'{{field_attendance}}'} style aliases.
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={target === 'subject' ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setTarget('subject')}
          >
            Subject
          </Button>
          <Button
            type="button"
            size="sm"
            variant={target === 'body' ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
            onClick={() => setTarget('body')}
          >
            Body
          </Button>
        </div>
      </div>
      <MergeChipRow label="Built-in" tokens={builtins} onInsert={insert} />
      {fields.length > 0 ? (
        <MergeChipRow label="Form fields" tokens={fields} onInsert={insert} />
      ) : null}
    </div>
  );
}

function MergeChipRow({
  label,
  tokens,
  onInsert,
}: {
  label: string;
  tokens: FormEmailMergeToken[];
  onInsert: (token: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p
        className={`text-[11px] font-medium tracking-wide uppercase ${workspaceTextMuted}`}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {tokens.map((item) => (
          <Button
            key={item.token}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            title={`Insert ${item.token} into the selected field`}
            onClick={() => onInsert(item.token)}
          >
            {item.label}
            <span
              className={`ml-1 font-mono text-[10px] ${workspaceTextMuted}`}
            >
              {item.token}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
