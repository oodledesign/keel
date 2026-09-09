import { describe, expect, it } from 'vitest';

import { jsonRpcHasId, readJsonRpcMethod } from './handler';

describe('ozer-mcp JSON-RPC helpers', () => {
  it('reads the method from a request and treats notifications as id-less', () => {
    expect(
      readJsonRpcMethod({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      }),
    ).toBe('initialize');

    expect(
      jsonRpcHasId({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    ).toBe(false);

    expect(
      jsonRpcHasId({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
    ).toBe(true);
  });
});
