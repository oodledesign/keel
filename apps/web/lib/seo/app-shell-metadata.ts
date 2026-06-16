import type { Metadata } from 'next';

import appConfig from '~/config/app.config';

const PRODUCT_NAME = appConfig.name;

export function buildPersonalShellMetadata(): Metadata {
  return {
    title: {
      template: `%s — Personal — ${PRODUCT_NAME}`,
      default: `Personal — ${PRODUCT_NAME}`,
    },
  };
}

export function buildWorkspaceShellMetadata(workspaceName: string): Metadata {
  const scope = workspaceName.trim() || 'Workspace';

  return {
    title: {
      template: `%s — ${scope} — ${PRODUCT_NAME}`,
      default: `${scope} — ${PRODUCT_NAME}`,
    },
  };
}
