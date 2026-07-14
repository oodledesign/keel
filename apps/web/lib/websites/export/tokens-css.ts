import { resolveTokens } from '@kit/site-blocks-core';

import type { WebsiteStyleTokens } from '../style-tokens';

/** CSS `:root` block from D1 StyleTokens via `resolveTokens` (`--sb-*`). */
export function styleTokensRootCss(tokens: WebsiteStyleTokens): string {
  const map = resolveTokens(tokens);
  const lines = Object.entries(map)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `:root {\n${lines}\n}\n`;
}
