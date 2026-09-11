'use client';

import { ChevronDown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
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
    <Collapsible>
      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40">
        <CollapsibleTrigger
          className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          data-test="campaign-form-link-toggle"
        >
          <span>
            <span className={`block text-sm font-semibold ${workspaceText}`}>
              Link a form
            </span>
            <span className={`mt-0.5 block text-sm ${workspaceTextMuted}`}>
              {formLink?.formName ?? 'Optional — pick a published form'}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/45 transition-transform',
              'group-data-[state=open]:rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t border-[color:var(--workspace-shell-border)] px-4 py-4">
          <p className={`text-sm ${workspaceTextMuted}`}>
            Insert <code className="text-xs">{'{{form_url}}'}</code> into a
            button or text. Each recipient gets their own public form link.
          </p>

          {forms.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              No published forms yet. Publish a form under Forms to link it
              here.
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
                      Prefill the form email field with the recipient&apos;s
                      email (<code className="text-xs">?email=</code> on the
                      public link)
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
                        void navigator.clipboard?.writeText(
                          CAMPAIGN_FORM_URL_TOKEN,
                        );
                      }}
                    >
                      Copy {'{{form_url}}'}
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
