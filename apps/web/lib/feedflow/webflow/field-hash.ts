import { createHash } from 'crypto';

export function fieldDataHash(data: Record<string, unknown>) {
  const sorted = Object.keys(data)
    .sort()
    .map((key) => [key, data[key]]);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
