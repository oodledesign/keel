'use client';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import {
  CAMPAIGN_FORM_URL_TOKEN,
  type CampaignFormLink,
} from '~/lib/campaigns/form-link';
import {
  workspaceSelectContentClass,
  workspaceSelectItemClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export type CampaignFormOption = {
  id: string;
  name: string;
  shareToken: string;
};

export function CampaignFormLinkCard({
  forms,
  formLink,
  disabled,
  onChange,
  onInsertFormButton,
}: {
  forms: CampaignFormOption[];
  formLink: CampaignFormLink | null;
  disabled?: boolean;
  onChange: (next: CampaignFormLink | null) => void;
  onInsertFormButton: () => void;
}) {
  const selectedId = formLink?.formId ?? '';

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-4">
      <div>
        <h3 className={`text-sm font-semibold ${workspaceText}`}>
          Link a form
        </h3>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Insert <code className="text-xs">{'{{form_url}}'}</code> into a
          button or text. Each recipient gets their own public form link.
        </p>
      </div>

      {forms.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No published forms yet. Publish a form under Forms to link it here.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Published form</Label>
            <Select
              value={selectedId || '__none__'}
              disabled={disabled}
              onValueChange={(value) => {
                if (value === '__none__') {
                  onChange(null);
                  return;
                }
                const form = forms.find((item) => item.id === value);
                if (!form) return;
                onChange({
                  formId: form.id,
                  shareToken: form.shareToken,
                  formName: form.name,
                  prefillEmail: formLink?.prefillEmail ?? true,
                });
              }}
            >
              <SelectTrigger data-test="campaign-form-link-select">
                <SelectValue placeholder="Choose a form" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem
                  className={workspaceSelectItemClass}
                  value="__none__"
                >
                  No form linked
                </SelectItem>
                {forms.map((form) => (
                  <SelectItem
                    key={form.id}
                    className={workspaceSelectItemClass}
                    value={form.id}
                  >
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formLink ? (
            <>
              <label
                className={cn(
                  'flex items-start gap-2 text-sm',
                  workspaceText,
                  disabled && 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  data-test="campaign-form-prefill-email"
                  checked={formLink.prefillEmail}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...formLink,
                      prefillEmail: event.target.checked,
                    })
                  }
                />
                <span>
                  Prefill the form email field with the recipient&apos;s email
                  (<code className="text-xs">?email=</code> on the public link)
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  data-test="campaign-insert-form-button"
                  onClick={onInsertFormButton}
                >
                  Insert form button
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    void navigator.clipboard?.writeText(CAMPAIGN_FORM_URL_TOKEN);
                  }}
                >
                  Copy {'{{form_url}}'}
                </Button>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
