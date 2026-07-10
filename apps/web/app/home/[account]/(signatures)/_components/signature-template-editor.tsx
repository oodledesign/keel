'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Moon, Save, Sun } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { saveSignatureTemplate } from '../_lib/server/signatures-module-actions';
import type {
  SignatureStaff,
  SignatureTemplate,
} from '../_lib/server/signatures-data';

const tokens = [
  'full_name',
  'job_title',
  'department',
  'phone_direct',
  'phone_mobile',
  'email',
  'branch',
  'photo_url',
  'website',
  'brand_accent_color',
] as const;

export function SignatureTemplateEditor({
  accountId,
  template,
  previewStaff,
}: {
  accountId: string;
  template: SignatureTemplate;
  previewStaff: SignatureStaff | null;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [name, setName] = useState(template.name);
  const [html, setHtml] = useState(template.html_template);
  const [isDefault, setIsDefault] = useState(template.is_default);
  const [previewHtml, setPreviewHtml] = useState(template.html_template);
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreviewHtml(html), 250);
    return () => window.clearTimeout(timeout);
  }, [html]);

  const renderedPreview = useMemo(() => {
    const staff = previewStaff;
    let output = previewHtml;

    for (const token of tokens) {
      let value = token;
      if (staff && token in staff) {
        value = String(staff[token as keyof SignatureStaff] ?? '');
      }
      output = output.replace(
        new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'gi'),
        value,
      );
    }

    return `<div style="color:#000000;font-family:Arial,Calibri,Georgia,sans-serif;line-height:1.4;">${output}</div>`;
  }, [previewHtml, previewStaff]);

  const insertToken = (token: string) => {
    const textarea = textareaRef.current;
    const insertion = `{{${token}}}`;
    if (!textarea) {
      setHtml((value) => `${value}${insertion}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setHtml((value) => `${value.slice(0, start)}${insertion}${value.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + insertion.length;
      textarea.selectionEnd = start + insertion.length;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSignatureTemplate({
        accountId,
        templateId: template.id,
        name,
        html_template: html,
        is_default: isDefault,
      });
      toast.success('Template saved');
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle>HTML template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
              />
              Default template
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="html-template">HTML</Label>
            <Textarea
              ref={textareaRef}
              id="html-template"
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              className="min-h-[520px] font-mono text-xs"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
            <div>
              <h3 className="text-sm font-medium">Token reference</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Click a token to insert it at the cursor.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-1 text-xs font-medium text-[#B8D3D7] transition hover:border-[#39AEB3]/60 hover:text-[var(--workspace-shell-text)]"
                >
                  {'{{'}
                  {token}
                  {'}}'}
                </button>
              ))}
            </div>
          </div>

          <Button type="button" onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save template'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Live preview</CardTitle>
            <p className="text-xs text-muted-foreground">
              Signatures are forced to light mode in real inboxes. Use Dark to
              check how a dark client chrome looks around the signature.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {previewStaff ? (
              <Badge variant="outline">{previewStaff.email}</Badge>
            ) : null}
            <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 px-2',
                  previewTheme === 'light' &&
                    'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
                onClick={() => setPreviewTheme('light')}
              >
                <Sun className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 px-2',
                  previewTheme === 'dark' &&
                    'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
                onClick={() => setPreviewTheme('dark')}
              >
                <Moon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'rounded-xl border border-[color:var(--workspace-shell-border)] p-3',
              previewTheme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
            )}
          >
            <iframe
              title="Template preview"
              srcDoc={renderedPreview}
              className="h-[680px] w-full rounded-lg border-0 bg-white"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
