'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Save } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

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

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreviewHtml(html), 250);
    return () => window.clearTimeout(timeout);
  }, [html]);

  const renderedPreview = useMemo(() => {
    const staff = previewStaff;
    let output = previewHtml;

    for (const token of tokens) {
      const value = staff ? String(staff[token] ?? '') : token;
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
      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
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

          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4">
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
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-[#B8D3D7] transition hover:border-[#39AEB3]/60 hover:text-white"
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

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live preview</CardTitle>
          {previewStaff ? (
            <Badge variant="outline">{previewStaff.email}</Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <iframe
            title="Template preview"
            srcDoc={renderedPreview}
            className="h-[680px] w-full rounded-xl border border-white/10 bg-white"
          />
        </CardContent>
      </Card>
    </div>
  );
}
