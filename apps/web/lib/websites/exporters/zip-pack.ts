import 'server-only';

import { strToU8, zipSync } from 'fflate';

import type { ExportPackFile } from './pack-utils';
import type { PromptPackFile } from './prompt-pack';

type ZipSourceFile = {
  path: string;
  content: string | Uint8Array;
};

/** Assemble a .zip (deflate) from pack files. Returns Uint8Array bytes. */
export function zipPackFiles(files: ZipSourceFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.path] =
      typeof file.content === 'string' ? strToU8(file.content) : file.content;
  }
  return zipSync(entries, { level: 6 });
}

export function zipPackToBase64(files: ZipSourceFile[]): string {
  const bytes = zipPackFiles(files);
  return Buffer.from(bytes).toString('base64');
}

/** @deprecated Prefer zipPackFiles — kept for prompt-pack call sites. */
export function zipPromptPackFiles(files: PromptPackFile[]): Uint8Array {
  return zipPackFiles(files);
}

/** @deprecated Prefer zipPackToBase64 — kept for prompt-pack call sites. */
export function zipPromptPackToBase64(files: PromptPackFile[]): string {
  return zipPackToBase64(files);
}

export type { ExportPackFile };
