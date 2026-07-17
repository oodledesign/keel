import { notFound } from 'next/navigation';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { loadResolvedSignatureAssets } from '~/lib/signatures/signature-assets';

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
  const [template, previewStaff, brand] = await Promise.all([
    loadTemplateDetail(accountId, id),
    loadTemplatePreviewStaff(accountId),
    loadAccountBrandResolved(accountId),
  ]);

  if (!template) {
    notFound();
  }

  const resolvedAssets = previewStaff
    ? await loadResolvedSignatureAssets(accountId, {
        department: previewStaff.department,
        branch_id: previewStaff.branch_id,
      })
    : null;

  return (
    <ModuleDataSection
      title={template.name}
      description="Edit the HTML template and use tokens for staff-specific data."
    >
      <SignatureTemplateEditor
        accountId={accountId}
        template={template}
        previewStaff={previewStaff}
        previewBrand={{
          primaryColor: brand.primary_color,
          secondaryColor: brand.secondary_color,
          accentColor: brand.accent_color,
          logoUrl: brand.logo_url,
          websiteUrl: brand.website_url,
          address: brand.address,
        }}
        previewAssetHtml={
          resolvedAssets
            ? {
                awardBadgesHtml: resolvedAssets.awardBadgesHtml,
                signatureCustomTextHtml: resolvedAssets.customTextHtml,
                awardBadgeUrl: resolvedAssets.awardBadgeUrl,
              }
            : undefined
        }
      />
    </ModuleDataSection>
  );
}
