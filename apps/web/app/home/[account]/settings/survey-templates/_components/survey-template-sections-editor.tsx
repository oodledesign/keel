'use client';

import { useState } from 'react';

import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  type SurveySectionOverride,
  resolveSurveySections,
  slugifyCustomSectionKey,
  snapshotResolvedSections,
} from '~/lib/building-surveyor/survey-sections-resolver';
import type { SurveyTemplateRecord } from '~/lib/building-surveyor/survey-template';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { updateSurveyTemplateAction } from '../../../surveys/_lib/server/survey-template-actions';

export function SurveyTemplateSectionsEditor({
  template,
  accountId,
  accountSlug,
  canEdit,
  onSave,
}: {
  template: SurveyTemplateRecord;
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  onSave: (next: SurveyTemplateRecord) => void;
}) {
  const [overrides, setOverrides] = useState<SurveySectionOverride[]>(
    template.sections ?? [],
  );
  const [newHeading, setNewHeading] = useState('');
  const [pending, setPending] = useState(false);

  const resolved = resolveSurveySections({
    level: template.surveyType === 'rics_hss_l3' ? 3 : 2,
    overrides,
  });

  const move = (index: number, delta: number) => {
    const next = [...resolved];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    setOverrides(snapshotResolvedSections(next));
  };

  const rename = (key: string, heading: string) => {
    const next = resolved.map((item) =>
      item.key === key ? { ...item, heading } : item,
    );
    setOverrides(snapshotResolvedSections(next));
  };

  const hide = (key: string) => {
    const existing = overrides.find((item) => item.key === key);
    if (existing) {
      setOverrides(
        overrides.map((item) =>
          item.key === key ? { ...item, hidden: true } : item,
        ),
      );
      return;
    }
    setOverrides([...overrides, { key, hidden: true }]);
  };

  const addCustom = () => {
    const heading = newHeading.trim();
    if (!heading) return;
    const key = slugifyCustomSectionKey(heading);
    if (resolved.some((item) => item.key === key)) {
      toast.error('That section already exists');
      return;
    }
    setOverrides([
      ...snapshotResolvedSections(resolved),
      {
        key,
        heading,
        onSitePickable: true,
        allowsPhotos: true,
        order: resolved.length,
      },
    ]);
    setNewHeading('');
  };

  const reset = () => {
    setOverrides([]);
  };

  const save = async () => {
    if (!canEdit) return;
    setPending(true);
    try {
      const next = await updateSurveyTemplateAction({
        accountId,
        accountSlug,
        templateId: template.id,
        sections: overrides.length === 0 ? null : overrides,
      });
      onSave(next);
      toast.success('Sections saved');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-[var(--workspace-shell-border)] pt-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Sections
          </p>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Add, rename, reorder or hide. Hidden sections keep existing notes.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canEdit || pending}
          onClick={reset}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset to default
        </Button>
      </div>

      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {resolved.map((item, index) => (
          <li
            key={item.key}
            className="flex items-center gap-2 rounded-md border border-[var(--workspace-shell-border)] px-2 py-1.5"
          >
            <Input
              value={item.heading}
              disabled={!canEdit}
              onChange={(event) => rename(item.key, event.target.value)}
              className="h-8 text-sm"
            />
            {item.isCustom ? (
              <span className={`shrink-0 text-[10px] ${workspaceTextMuted}`}>
                custom
              </span>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={!canEdit || index === 0}
              onClick={() => move(index, -1)}
              aria-label="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={!canEdit || index === resolved.length - 1}
              onClick={() => move(index, 1)}
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={!canEdit}
              onClick={() => hide(item.key)}
              aria-label="Hide section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newHeading}
          disabled={!canEdit}
          placeholder="Security and alarms"
          onChange={(event) => setNewHeading(event.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canEdit || !newHeading.trim()}
          onClick={addCustom}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add section
        </Button>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          disabled={!canEdit || pending}
          onClick={() => void save()}
        >
          Save sections
        </Button>
      </div>
    </div>
  );
}
