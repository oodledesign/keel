/**
 * Build a searchable JSON corpus from apps/docs MDX for support docs chat.
 * Run from apps/web: node scripts/generate-docs-corpus.mjs
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '../..');
const docsContentRoot = path.join(repoRoot, 'apps/docs/content');
const outPath = path.join(
  webRoot,
  'lib/support/docs-corpus.generated.json',
);

const CHUNK_TARGET = 1000;
const CHUNK_OVERLAP = 120;

async function walkMdx(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMdx(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      files.push(full);
    }
  }

  return files;
}

function mdxPathToRoute(absoluteFile) {
  const rel = path.relative(docsContentRoot, absoluteFile).replace(/\\/g, '/');
  let route = rel.replace(/\.mdx$/, '');
  if (route.endsWith('/index')) {
    route = route.slice(0, -'/index'.length);
  }
  if (route === 'index' || route === '') {
    return '/';
  }
  return `/${route}`;
}

function stripMdx(source) {
  let text = source;
  // Frontmatter
  text = text.replace(/^---[\s\S]*?---\s*/m, '');
  // Import / export lines
  text = text.replace(/^(?:import|export)\s.+;?\s*$/gm, '');
  // JSX / MDX components (rough)
  text = text.replace(/<[^>]+>/g, ' ');
  // Code fences → keep inner text lightly
  text = text.replace(/```[\w-]*\n([\s\S]*?)```/g, ' $1 ');
  // Inline code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Images / links — keep label
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Headings markers
  text = text.replace(/^#{1,6}\s+/gm, '');
  // Emphasis
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  // Collapse whitespace
  text = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
  return text.trim();
}

function extractTitle(source, route) {
  const heading = source.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }
  const segment = route.split('/').filter(Boolean).pop() ?? 'Docs';
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function chunkText(text) {
  if (text.length <= CHUNK_TARGET) {
    return text ? [text] : [];
  }

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_TARGET, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('\n'),
      );
      if (breakAt > CHUNK_TARGET * 0.4) {
        end = start + breakAt + 1;
      }
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

async function main() {
  try {
    await fs.access(docsContentRoot);
  } catch {
    console.warn(
      `[generate-docs-corpus] Missing ${docsContentRoot}; writing empty corpus`,
    );
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(
      outPath,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), chunks: [] }, null, 2)}\n`,
    );
    return;
  }

  const files = await walkMdx(docsContentRoot);
  const chunks = [];

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const route = mdxPathToRoute(file);
    const title = extractTitle(source, route);
    const plain = stripMdx(source);
    const parts = chunkText(plain);

    parts.forEach((text, index) => {
      const id = createHash('sha1')
        .update(`${route}:${index}:${text.slice(0, 80)}`)
        .digest('hex')
        .slice(0, 12);
      chunks.push({
        id,
        path: route,
        title,
        text,
      });
    });
  }

  chunks.sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    chunkCount: chunks.length,
    chunks,
  };
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `[generate-docs-corpus] Wrote ${chunks.length} chunks from ${files.length} pages → ${path.relative(webRoot, outPath)}`,
  );
}

main().catch((error) => {
  console.error('[generate-docs-corpus] failed', error);
  process.exit(1);
});
