import { use } from 'react';

import { EnvMode } from '@/app/variables/lib/types';

import {
  createKitEnvDeps,
  createKitEnvService,
  findWorkspaceRoot,
} from '@kit/mcp-server/env';
import { Page, PageBody, PageHeader } from '@kit/ui/page';

import { AppEnvironmentVariablesManager } from './components/app-environment-variables-manager';

type VariablesPageProps = {
  searchParams: Promise<{ mode?: EnvMode }>;
};

export const metadata = {
  title: 'Environment Variables',
};

export default function VariablesPage({ searchParams }: VariablesPageProps) {
  const { mode = 'development' } = use(searchParams);
  const apps = use(loadEnvStates(mode));

  return (
    <Page style={'custom'}>
      <div className={'flex h-screen flex-col overflow-hidden'}>
        <PageHeader
          displaySidebarTrigger={false}
          title={'Environment Variables'}
          description={
            'Manage environment variables for your applications. Validate and set them up easily.'
          }
        />

        <PageBody className={'overflow-hidden'}>
          <div className={'flex h-full flex-1 flex-col space-y-4'}>
            {apps.map((app) => (
              <AppEnvironmentVariablesManager key={app.appName} state={app} />
            ))}
          </div>
        </PageBody>
      </div>
    </Page>
  );
}

async function loadEnvStates(mode: EnvMode) {
  const rootPath = findWorkspaceRoot(process.cwd());
  const service = createKitEnvService(createKitEnvDeps(rootPath));
  return service.getAppState(mode);
}
