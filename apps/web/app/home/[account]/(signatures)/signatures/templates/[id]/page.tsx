import { notFound } from 'next/navigation';

import { ModuleDataSection } from '../../../../_components/module-data-section';
import { SignatureTemplateEditor } from '../../../_components/signature-template-editor';
import {
  loadSignaturesWorkspace,
  loadTemplateDetail,
  loadTemplatePreviewStaff,
} from '../../../_lib/server/signatures-data';

type SignatureTemplateDetailPageProps = {
  params: Promise<{ account: string; id: string }>;
};

export default async function SignatureTemplateDetailPage({
  params,
}: SignatureTemplateDetailPageProps) {
  const { account, id } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [template, previewStaff] = await Promise.all([
    loadTemplateDetail(accountId, id),
    loadTemplatePreviewStaff(accountId),
  ]);

  if (!template) {
    notFound();
  }

  return (
    <ModuleDataSection
      title={template.name}
      description="Edit the HTML template and use tokens for staff-specific data."
    >
      <SignatureTemplateEditor
        accountId={accountId}
        template={template}
        previewStaff={previewStaff}
      />
    </ModuleDataSection>
  );
}
