'use client';

import { useRef, useState } from 'react';

import { Loader2, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { SurveyPhraseBank } from '../../../surveys/_lib/schema/survey-phrases.schema';
import {
  deleteSurveyPhraseBankAction,
  importGoreportPhrasesAction,
} from '../../../surveys/_lib/server/survey-phrase-actions';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function SurveyPhrasesSettingsClient({
  accountId,
  accountSlug,
  canEdit,
  initialBanks,
}: {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  initialBanks: SurveyPhraseBank[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [banks, setBanks] = useState(initialBanks);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'personal' | 'workspace'>('personal');
  const [surveyType, setSurveyType] = useState<'rics_hss_l3' | 'rics_hss_l2'>(
    'rics_hss_l3',
  );
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !canEdit) return;
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const result = await importGoreportPhrasesAction({
        accountId,
        accountSlug,
        name: name.trim() || file.name.replace(/\.xlsx$/i, ''),
        scope,
        surveyType,
        fileBase64,
        fileName: file.name,
      });
      setBanks((prev) => [result.bank, ...prev]);
      setName('');
      toast.success(
        `Imported ${result.imported} phrases from ${result.fieldCount} GoReport fields.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <section className={`${workspacePanelCard} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Phrase banks
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Import a GoReport Predefined Responses workbook. Phrases stay on your
          user (or this workspace) and are never seeded for other tenants.
        </p>

        {canEdit ? (
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="bank-name">Bank name</Label>
              <Input
                id="bank-name"
                className="mt-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Caroline Level 3"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Scope</Label>
                <select
                  className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-2 text-sm"
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as 'personal' | 'workspace')
                  }
                >
                  <option value="personal">Personal</option>
                  <option value="workspace">Workspace shared</option>
                </select>
              </div>
              <div>
                <Label>Survey type</Label>
                <select
                  className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-2 text-sm"
                  value={surveyType}
                  onChange={(event) =>
                    setSurveyType(
                      event.target.value as 'rics_hss_l3' | 'rics_hss_l2',
                    )
                  }
                >
                  <option value="rics_hss_l3">RICS Home Survey Level 3</option>
                  <option value="rics_hss_l2">RICS Home Survey Level 2</option>
                </select>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
            />
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import GoReport xlsx
            </Button>
          </div>
        ) : (
          <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
            You can view phrase banks but cannot import.
          </p>
        )}
      </section>

      {banks.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No phrase banks yet. Import a Predefined Responses export to insert
          phrases from the survey editor.
        </p>
      ) : (
        <ul className="space-y-3">
          {banks.map((bank) => (
            <li
              key={bank.id}
              className={`${workspacePanelCard} flex items-start justify-between gap-3 p-4`}
            >
              <div>
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {bank.name}
                </p>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  {bank.scope} · {bank.phraseCount} phrases
                  {bank.surveyType ? ` · ${bank.surveyType}` : ''}
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete phrase bank"
                  onClick={() => {
                    void (async () => {
                      try {
                        await deleteSurveyPhraseBankAction({
                          accountId,
                          accountSlug,
                          bankId: bank.id,
                        });
                        setBanks((prev) =>
                          prev.filter((item) => item.id !== bank.id),
                        );
                      } catch (error) {
                        toast.error(getErrorMessage(error));
                      }
                    })();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
