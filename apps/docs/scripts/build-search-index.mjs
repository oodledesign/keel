/**
 * Build the Pagefind search index from the MDX in content/ into
 * public/_pagefind, before `next build`.
 *
 * Indexing the built HTML doesn't work here: the docs template reads request
 * headers, so every page renders on demand and the build has no static HTML.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pagefind from 'pagefind';

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const contentRoot = path.join(docsRoot, 'content');
const outputPath = path.join(docsRoot, 'public/_pagefind');

async function walkMdx(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMdx(full)));
    else if (entry.isFile() && entry.name.endsWith('.mdx')) files.push(full);
  }
  return files;
}

function routeFor(file) {
  const rel = path.relative(contentRoot, file).replace(/\\/g, '/');
  const route = rel.replace(/\.mdx$/, '').replace(/(^|\/)index$/, '');
  return `/${route}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline markdown to plain text. */
function plain(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Matches the heading ids Nextra renders (github-slugger), so results link to sections. */
function createSlugger() {
  const seen = new Map();
  return (heading) => {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

function mdxToHtml(source) {
  const slug = createSlugger();
  const body = source
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/^(?:import|export)\s.*$/gm, '')
    .replace(/```[\w-]*\n([\s\S]*?)```/g, '$1');

  const html = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const text = plain(heading[2]);
      const id = level === 1 ? '' : ` id="${escapeHtml(slug(text))}"`;
      html.push(`<h${level}${id}>${escapeHtml(text)}</h${level}>`);
      continue;
    }
    if (line === '' || /^\|?\s*:?-{3,}/.test(line)) {
      flush();
      continue;
    }
    const text = plain(
      line
        .replace(/^\|(.*)\|$/, '$1')
        .replace(/\s*\|\s*/g, ' · ')
        .replace(/^(?:[-*+]|\d+\.)\s+/, ''),
    );
    if (text) paragraph.push(text);
  }
  flush();

  return `<!doctype html><html lang="en"><body><main>${html.join('')}</main></body></html>`;
}

async function main() {
  const files = await walkMdx(contentRoot);
  const { index, errors } = await pagefind.createIndex({});
  if (!index) throw new Error(errors.join('\n'));

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const { errors: fileErrors } = await index.addHTMLFile({
      url: routeFor(file),
      content: mdxToHtml(source),
    });
    if (fileErrors.length > 0) {
      throw new Error(
        `${path.relative(docsRoot, file)}: ${fileErrors.join('; ')}`,
      );
    }
  }

  await fs.rm(outputPath, { recursive: true, force: true });
  const written = await index.writeFiles({ outputPath });
  if (written.errors.length > 0) throw new Error(written.errors.join('\n'));
  await pagefind.close();

  console.log(
    `[docs] Search index: ${files.length} pages → ${path.relative(docsRoot, outputPath)}`,
  );
}

main().catch(async (error) => {
  console.error('[docs] Search index failed', error);
  await pagefind.close().catch(() => {});
  process.exit(1);
});
