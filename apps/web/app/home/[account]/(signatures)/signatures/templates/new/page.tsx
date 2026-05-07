import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import {
  createTemplateAndReturnId,
  loadSignaturesWorkspace,
} from '../../../_lib/server/signatures-data';

type NewSignatureTemplatePageProps = {
  params: Promise<{ account: string }>;
};

export default async function NewSignatureTemplatePage({
  params,
}: NewSignatureTemplatePageProps) {
  const { account } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const id = await createTemplateAndReturnId(accountId);

  redirect(
    pathsConfig.app.accountSignaturesTemplateDetail
      .replace('[account]', account)
      .replace('[templateId]', id),
  );
}
