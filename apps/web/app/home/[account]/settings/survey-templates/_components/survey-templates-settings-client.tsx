'use client';

import { useState } from 'react';

import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  SYSTEM_SURVEY_TEMPLATES,
  type SurveySystemTemplateKey,
  type SurveyTemplateRecord,
} from '~/lib/building-surveyor/survey-template';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  cloneSurveyTemplateAction,
  deleteSurveyTemplateAction,
  updateSurveyTemplateAction,
} from '../../../surveys/_lib/server/survey-template-actions';

export function SurveyTemplatesSettingsClient({
  accountId,
  accountSlug,
  canEdit,
  initialTemplates,
}: {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  initialTemplates: SurveyTemplateRecord[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const clone = async (systemKey: SurveySystemTemplateKey) => {
    if (!canEdit) return;
    setPendingKey(systemKey);
    try {
      const created = await cloneSurveyTemplateAction({
        accountId,
        accountSlug,
        systemKey,
        setDefault: templates.every((item) => item.surveyType !== systemKey),
      });
      setTemplates((prev) => [created, ...prev]);
      toast.success(`Cloned ${created.name}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${workspacePanelCard} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          System templates
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Clone a RICS Home Survey shell for this workspace. Static copy and
          brand tokens stay editable; generated content fills slots at draft
          time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            Object.keys(SYSTEM_SURVEY_TEMPLATES) as SurveySystemTemplateKey[]
          ).map((key) => (
            <Button
              key={key}
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={!canEdit || pendingKey === key}
              onClick={() => void clone(key)}
            >
              {pendingKey === key ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Clone {SYSTEM_SURVEY_TEMPLATES[key].name}
            </Button>
          ))}
        </div>
      </section>

      {templates.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No workspace templates yet. Clone Level 3 to start the Bracketts-style
          shell.
        </p>
      ) : (
        <ul className="space-y-4">
          {templates.map((template) => {
            const editing = editingId === template.id;
            const staticBlocks = template.blocks.filter(
              (block) => block.staticHtml && block.kind !== 'cover',
            );
            return (
              <li
                key={template.id}
                className={`${workspacePanelCard} space-y-3 p-4 sm:p-5`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {template.name}
                      {template.isDefault ? ' · default' : ''}
                    </p>
                    <p className={`text-xs ${workspaceTextMuted}`}>
                      {template.surveyType} · {template.blocks.length} blocks
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditingId(editing ? null : template.id)
                        }
                      >
                        {editing ? 'Close' : 'Edit copy'}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Delete template"
                        onClick={() => {
                          void (async () => {
                            try {
                              await deleteSurveyTemplateAction({
                                accountId,
                                accountSlug,
                                templateId: template.id,
                              });
                              setTemplates((prev) =>
                                prev.filter((item) => item.id !== template.id),
                              );
                            } catch (error) {
                              toast.error(getErrorMessage(error));
                            }
                          })();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {editing ? (
                  <TemplateEditor
                    template={template}
                    staticBlocks={staticBlocks}
                    canEdit={canEdit}
                    accountId={accountId}
                    accountSlug={accountSlug}
                    onSave={(next) => {
                      setTemplates((prev) =>
                        prev.map((item) => (item.id === next.id ? next : item)),
                      );
                      setEditingId(null);
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  staticBlocks,
  canEdit,
  accountId,
  accountSlug,
  onSave,
}: {
  template: SurveyTemplateRecord;
  staticBlocks: SurveyTemplateRecord['blocks'];
  canEdit: boolean;
  accountId: string;
  accountSlug: string;
  onSave: (next: SurveyTemplateRecord) => void;
}) {
  const [name, setName] = useState(template.name);
  const [footerLabel, setFooterLabel] = useState(
    template.brand.footerLabel ?? '',
  );
  const [primaryColor, setPrimaryColor] = useState(
    template.brand.primaryColor ?? '#4A2C6A',
  );
  const [htmlById, setHtmlById] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      staticBlocks.map((block) => [block.id, block.staticHtml ?? '']),
    ),
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input
          className="mt-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Footer label</Label>
          <Input
            className="mt-1"
            value={footerLabel}
            onChange={(event) => setFooterLabel(event.target.value)}
          />
        </div>
        <div>
          <Label>Primary colour</Label>
          <Input
            className="mt-1"
            value={primaryColor}
            onChange={(event) => setPrimaryColor(event.target.value)}
          />
        </div>
      </div>
      {staticBlocks.slice(0, 8).map((block) => (
        <div key={block.id}>
          <Label>
            {block.title || block.kind}
            {block.letter ? ` (${block.letter})` : ''}
          </Label>
          <Textarea
            className="mt-1 min-h-24 font-mono text-xs"
            value={htmlById[block.id] ?? ''}
            onChange={(event) =>
              setHtmlById((prev) => ({
                ...prev,
                [block.id]: event.target.value,
              }))
            }
          />
        </div>
      ))}
      <Button
        type="button"
        className={workspaceBtnPrimaryMd}
        disabled={!canEdit || saving}
        onClick={() => {
          setSaving(true);
          void (async () => {
            try {
              const next = await updateSurveyTemplateAction({
                accountId,
                accountSlug,
                templateId: template.id,
                name,
                brand: { ...template.brand, footerLabel, primaryColor },
                blocks: template.blocks.map((block) =>
                  htmlById[block.id] !== undefined
                    ? { ...block, staticHtml: htmlById[block.id] }
                    : block,
                ),
              });
              onSave(next);
              toast.success('Template updated');
            } catch (error) {
              toast.error(getErrorMessage(error));
            } finally {
              setSaving(false);
            }
          })();
        }}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}
