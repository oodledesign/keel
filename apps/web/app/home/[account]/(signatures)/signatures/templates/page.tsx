import Link from 'next/link';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignatureTemplatePreviewCard } from '../../_components/signature-template-preview-card';
import {
  loadSignaturesWorkspace,
  loadStaffRows,
  loadTemplates,
} from '../../_lib/server/signatures-data';

type SignaturesTemplatesPageProps = {
  params: Promise<{ account: string }>;
};

export default async function SignaturesTemplatesPage({
  params,
}: SignaturesTemplatesPageProps) {
  const { account } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [templates, staff] = await Promise.all([
    loadTemplates(accountId),
    loadStaffRows(accountId),
  ]);
  const previewStaff = staff[0] ?? null;
  const newPath = `${pathsConfig.app.accountSignaturesTemplates.replace(
    '[account]',
    account,
  )}/new`;

  return (
    <ModuleDataSection
      title="Templates"
      description="Create and edit reusable HTML email signature templates. Cards show a live preview with sample staff data."
    >
      <div className="mb-4 flex justify-end">
        <Button asChild>
          <Link href={newPath}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-sm text-muted-foreground">
          No templates yet. Create a default template to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const href = pathsConfig.app.accountSignaturesTemplateDetail
              .replace('[account]', account)
              .replace('[templateId]', template.id);
            const previewSrc =
              previewStaff != null
                ? `/api/signatures/preview?staffId=${encodeURIComponent(previewStaff.id)}&templateId=${encodeURIComponent(template.id)}`
                : null;

            return (
              <SignatureTemplatePreviewCard
                key={template.id}
                template={template}
                href={href}
                previewSrc={previewSrc}
              />
            );
          })}
        </div>
      )}

      {!previewStaff && templates.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Sync at least one staff member to see live HTML previews on these cards.
        </p>
      ) : null}
    </ModuleDataSection>
  );
}
