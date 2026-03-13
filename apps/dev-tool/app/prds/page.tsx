import { Metadata } from 'next';

import { PRDsListInterface } from './_components/prds-list-interface';
import { loadPRDs } from './_lib/server/prd-loader';

export const metadata: Metadata = {
  title: 'PRDs - MCP Server',
  description: 'Browse and view all Product Requirements Documents',
};

export default async function PRDsPage() {
  // Load PRDs on the server side
  const initialPrds = await loadPRDs();

  return <PRDsListInterface initialPrds={initialPrds} />;
}
