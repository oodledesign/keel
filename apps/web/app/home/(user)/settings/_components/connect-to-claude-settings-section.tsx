import 'server-only';

import { getMcpResourceUrl } from '@kit/ozer-mcp';

import { ConnectToClaudeCard } from './connect-to-claude-card';

export function ConnectToClaudeSettingsSection() {
  return <ConnectToClaudeCard connectorUrl={getMcpResourceUrl()} />;
}
