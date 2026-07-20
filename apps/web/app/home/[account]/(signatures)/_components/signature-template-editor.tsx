'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Info,
  LayoutTemplate,
  Save,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  SIGNATURE_TEMPLATE_TOKENS,
  type SignatureBuilderDocument,
  createMinimalSignatureDocument,
  htmlToSignatureBlocks,
  signatureBlocksToHtml,
} from '~/lib/signatures/signature-blocks';
import { buildSignaturePreviewDocument } from '~/lib/signatures/signature-preview-document';
import {
  SIGNATURE_DARK_MODE_CHECKLIST,
  lintSignatureTemplateHtml,
} from '~/lib/signatures/template-dark-mode-lint';

import type {
  SignatureStaff,
  SignatureTemplate,
} from '../_lib/server/signatures-data';
import { saveSignatureTemplate } from '../_lib/server/signatures-module-actions';
import {
  SignaturePreviewFrame,
  type SignaturePreviewTheme,
} from './signature-preview-frame';
import { SignaturePreviewLinkButton } from './signature-preview-link-button';
import { SignatureVisualEditor } from './signature-visual-editor';

type EditorMode = 'visual' | 'html';

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export type SignatureTemplatePreviewBrand = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
};

export function SignatureTemplateEditor({
  accountId,
  template,
  previewStaff,
  previewBrand,
  previewAssetHtml,
}: {
  accountId: string;
  template: SignatureTemplate;
  previewStaff: SignatureStaff | null;
  previewBrand?: SignatureTemplatePreviewBrand | null;
  previewAssetHtml?: {
    awardBadgesHtml: string;
    signatureCustomTextHtml: string;
    awardBadgeUrl: string | null;
  };
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [name, setName] = useState(template.name);
  const [visualDoc, setVisualDoc] = useState<SignatureBuilderDocument | null>(
    () => htmlToSignatureBlocks(template.html_template),
  );
  const [html, setHtml] = useState(() => {
    const parsed = htmlToSignatureBlocks(template.html_template);
    return parsed ? signatureBlocksToHtml(parsed) : template.html_template;
  });
  const [mode, setMode] = useState<EditorMode>('visual');
  const [isDefault, setIsDefault] = useState(template.is_default);
  const [previewHtml, setPreviewHtml] = useState(() => {
    const parsed = htmlToSignatureBlocks(template.html_template);
    return parsed ? signatureBlocksToHtml(parsed) : template.html_template;
  });
  const [saving, setSaving] = useState(false);
  const [previewTheme, setPreviewTheme] =
    useState<SignaturePreviewTheme>('light');

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreviewHtml(html), 250);
    return () => window.clearTimeout(timeout);
  }, [html]);

  const previewBodyHtml = useMemo(() => {
    const staff = previewStaff;
    let output = previewHtml;

    for (const token of SIGNATURE_TEMPLATE_TOKENS) {
      let value = '';
      if (staff && token in staff) {
        value = String(staff[token as keyof SignatureStaff] ?? '');
      }

      if (token === 'award_badges') {
        value = previewAssetHtml?.awardBadgesHtml ?? '';
      } else if (token === 'signature_custom_text') {
        value = previewAssetHtml?.signatureCustomTextHtml ?? '';
      } else if (token === 'award_badge_url') {
        value = previewAssetHtml?.awardBadgeUrl?.trim() || TRANSPARENT_PIXEL;
      } else if (token === 'brand_logo_url' || token === 'company_logo_url') {
        value = previewBrand?.logoUrl?.trim() || TRANSPARENT_PIXEL;
      } else if (token === 'brand_primary_color') {
        value = previewBrand?.primaryColor?.trim() || '#0D2344';
      } else if (token === 'brand_secondary_color') {
        value = previewBrand?.secondaryColor?.trim() || '#FFFFFF';
      } else if (token === 'brand_accent_color') {
        value = previewBrand?.accentColor?.trim() || '#e63329';
      } else if (token === 'website') {
        value = previewBrand?.websiteUrl?.trim() || '';
      } else if (token === 'address') {
        value =
          (staff as { address?: string | null } | null)?.address?.trim() ||
          previewBrand?.address?.trim() ||
          '';
      } else if (token === 'credentials') {
        value = staff?.credentials?.trim() ?? '';
      }

      output = output.replace(
        new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'gi'),
        value,
      );
    }

    return `<div style="color:#333333;font-family:Arial,Calibri,Georgia,sans-serif;line-height:1.4;">${output}</div>`;
  }, [previewHtml, previewStaff, previewAssetHtml, previewBrand]);

  const lintIssues = useMemo(() => lintSignatureTemplateHtml(html), [html]);
  const lintWarnings = lintIssues.filter((issue) => issue.severity === 'warn');

  const applyVisualDoc = (next: SignatureBuilderDocument) => {
    setVisualDoc(next);
    setHtml(signatureBlocksToHtml(next));
  };

  const handleHtmlChange = (value: string) => {
    setHtml(value);
    setVisualDoc(htmlToSignatureBlocks(value));
  };

  const startVisualLayout = () => {
    applyVisualDoc(createMinimalSignatureDocument());
    setMode('visual');
    toast.success('Visual layout ready', {
      description:
        'Drag blocks to build the signature. Save when you are happy.',
    });
  };

  const insertToken = (token: string) => {
    const textarea = textareaRef.current;
    const insertion = `{{${token}}}`;
    if (!textarea) {
      handleHtmlChange(`${html}${insertion}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${html.slice(0, start)}${insertion}${html.slice(end)}`;
    handleHtmlChange(next);
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
      if (lintWarnings.length > 0) {
        toast.success('Template saved', {
          description: `${lintWarnings.length} dark-mode warning${lintWarnings.length === 1 ? '' : 's'} still open — review the checklist before publishing.`,
        });
      } else {
        toast.success('Template saved');
      }
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
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Signature template</CardTitle>
              <p className="text-muted-foreground text-xs">
                Use the visual builder for drag-and-drop editing, or switch to
                HTML for full control. Both save to the same template.
              </p>
            </div>
          </div>

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
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as EditorMode)}
          >
            <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
              <TabsTrigger value="visual" className="gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="html" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                HTML
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="mt-4 space-y-4">
              <SignatureVisualEditor
                document={visualDoc}
                onChange={applyVisualDoc}
                onStartVisual={startVisualLayout}
              />
            </TabsContent>

            <TabsContent value="html" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="html-template">HTML</Label>
                <Textarea
                  ref={textareaRef}
                  id="html-template"
                  value={html}
                  onChange={(event) => handleHtmlChange(event.target.value)}
                  className="min-h-[420px] font-mono text-xs"
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
                <div>
                  <h3 className="text-sm font-medium">Token reference</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Click a token to insert it at the cursor.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SIGNATURE_TEMPLATE_TOKENS.map((token) => (
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
            </TabsContent>
          </Tabs>

          <div className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Dark-mode resilience
                </h3>
                <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  Soft checks only — saving is never blocked. Fix warnings
                  before publishing to staff inboxes.
                </p>
              </div>
              {lintWarnings.length === 0 ? (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-emerald-600/40 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Looking good
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 border-amber-600/40 text-amber-800 dark:border-amber-500/40 dark:text-amber-200"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {lintWarnings.length} warning
                  {lintWarnings.length === 1 ? '' : 's'}
                </Badge>
              )}
            </div>

            {lintIssues.length > 0 ? (
              <ul className="space-y-2">
                {lintIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs',
                      issue.severity === 'warn'
                        ? 'border-amber-600/35 bg-amber-500/15'
                        : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {issue.severity === 'warn' ? (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                      ) : (
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-medium text-[var(--workspace-shell-text)]">
                          {issue.title}
                        </p>
                        <p className="text-[var(--workspace-shell-text-muted)]">
                          {issue.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className="space-y-1.5 border-t border-[color:var(--workspace-shell-border)] pt-3 text-xs text-[var(--workspace-shell-text-muted)]">
              {SIGNATURE_DARK_MODE_CHECKLIST.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[var(--ozer-info)]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button type="button" onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save template'}
            {lintWarnings.length > 0 ? (
              <span className="ml-2 text-xs opacity-70">
                ({lintWarnings.length} warning
                {lintWarnings.length === 1 ? '' : 's'})
              </span>
            ) : null}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader className="space-y-3">
          <div className="space-y-1">
            <CardTitle>Live preview</CardTitle>
            <p className="text-muted-foreground text-xs">
              Check mobile, tablet, and desktop widths against light or dark
              inbox chrome. Prefer mid-grey text (#333), underlined links, and
              transparent logos — clients invert colours inconsistently unless
              you set a signature background.
            </p>
          </div>
          <SignaturePreviewLinkButton
            accountId={accountId}
            templateId={template.id}
            staffId={previewStaff?.id ?? null}
          />
        </CardHeader>
        <CardContent>
          <SignaturePreviewFrame
            theme={previewTheme}
            onThemeChange={setPreviewTheme}
            heightClassName="h-[680px]"
            toolbarExtra={
              previewStaff ? (
                <Badge variant="outline">{previewStaff.email}</Badge>
              ) : null
            }
          >
            {({ viewport, layoutWidthPx, theme }) => (
              <iframe
                key={`${theme}-${viewport}`}
                title="Template preview"
                srcDoc={buildSignaturePreviewDocument({
                  bodyHtml: previewBodyHtml,
                  theme,
                  layoutWidthPx,
                  bodyPadding: '16px',
                })}
                sandbox=""
                className={cn(
                  'h-full w-full rounded-lg border-0',
                  theme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
                )}
              />
            )}
          </SignaturePreviewFrame>
        </CardContent>
      </Card>
    </div>
  );
}
