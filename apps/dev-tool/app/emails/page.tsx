import Link from 'next/link';

import {
  createKitEmailsDeps,
  createKitEmailsService,
} from '@kit/mcp-server/emails';
import { findWorkspaceRoot } from '@kit/mcp-server/env';
import {
  CardButton,
  CardButtonHeader,
  CardButtonTitle,
} from '@kit/ui/card-button';
import { Heading } from '@kit/ui/heading';
import { Page, PageBody, PageHeader } from '@kit/ui/page';

export const metadata = {
  title: 'Emails',
};

const CATEGORY_LABELS: Record<string, string> = {
  'supabase-auth': 'Supabase Auth Emails',
  transactional: 'Transactional Emails',
};

export default async function EmailsPage() {
  const rootPath = findWorkspaceRoot(process.cwd());
  const service = createKitEmailsService(createKitEmailsDeps(rootPath));
  const { templates, categories } = await service.list();

  return (
    <Page style={'custom'}>
      <PageHeader
        displaySidebarTrigger={false}
        title="Emails"
        description={'Manage your application Email templates'}
      />

      <PageBody className={'gap-y-8'}>
        {categories.map((category) => {
          const categoryTemplates = templates.filter(
            (t) => t.category === category,
          );

          return (
            <div key={category} className={'flex flex-col space-y-4'}>
              <Heading level={5}>
                {CATEGORY_LABELS[category] ?? category}
              </Heading>

              <div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
                {categoryTemplates.map((template) => (
                  <CardButton key={template.id} asChild>
                    <Link href={`/emails/${template.id}`}>
                      <CardButtonHeader>
                        <CardButtonTitle>{template.name}</CardButtonTitle>
                      </CardButtonHeader>
                    </Link>
                  </CardButton>
                ))}
              </div>
            </div>
          );
        })}
      </PageBody>
    </Page>
  );
}
