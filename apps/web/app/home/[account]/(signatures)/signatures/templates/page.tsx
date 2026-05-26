import Link from 'next/link';

import { FileText, Plus } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import { ModuleDataSection } from '../../../_components/module-data-section';
import {
  loadSignaturesWorkspace,
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
  const templates = await loadTemplates(accountId);
  const newPath = `${pathsConfig.app.accountSignaturesTemplates.replace(
    '[account]',
    account,
  )}/new`;

  return (
    <ModuleDataSection
      title="Templates"
      description="Create and edit reusable HTML email signature templates."
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
        <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-8 text-sm text-muted-foreground">
          No templates yet. Create a default template to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const href = pathsConfig.app.accountSignaturesTemplateDetail
              .replace('[account]', account)
              .replace('[templateId]', template.id);

            return (
              <Card
                key={template.id}
                className="overflow-hidden border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              >
                <div className="flex h-40 items-center justify-center border-b border-white/10 bg-white p-4">
                  {template.preview_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.preview_image_url}
                      alt=""
                      className="max-h-full max-w-full rounded object-contain"
                    />
                  ) : (
                    <FileText className="h-10 w-10 text-[#465B6F]" />
                  )}
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.is_default ? (
                      <Badge className="bg-[var(--keel-teal)]/10 text-[var(--keel-teal)]">
                        Default
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" size="sm">
                    <Link href={href}>Open editor</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ModuleDataSection>
  );
}
