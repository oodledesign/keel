import type { ActivityBlockListRow } from '~/lib/activity/activity-history';

export type ActivityAppContextKind =
  | 'ide'
  | 'design'
  | 'document'
  | 'email'
  | 'browser'
  | 'generic';

export type ActivityAppContext = {
  kind: ActivityAppContextKind;
  item: string | null;
  detail: string | null;
  meta: string | null;
  context: string | null;
};

const FILE_EXTENSION_PATTERN = /\.[a-z0-9][\w.-]*$/i;

const IDE_SUFFIXES = new Set(['cursor', 'visual studio code', 'code']);
const DESIGN_SUFFIXES = new Set(['figma', 'adobe illustrator', 'illustrator']);
const DOCUMENT_SUFFIXES = new Set(['microsoft word', 'word']);
const GOOGLE_WORKSPACE_SUFFIXES = new Set([
  'google docs',
  'google sheets',
  'google slides',
]);
const EMAIL_SUFFIXES = new Set([
  'mail',
  'outlook',
  'spark',
  'airmail',
  'mimestream',
  'superhuman',
  'gmail',
]);

const GENERIC_APP_TITLES = new Set([
  'mail',
  'outlook',
  'spark',
  'inbox',
  'gmail',
  'airmail',
  'figma',
  'cursor',
  'word',
  'microsoft word',
]);

function normalizeTitleSeparators(title: string) {
  return title.replace(/\s*[—–]\s*/g, ' - ');
}

function splitTitleParts(title: string) {
  return normalizeTitleSeparators(title)
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function basename(path: string) {
  const trimmed = path.trim();
  const segments = trimmed.split('/');
  return segments[segments.length - 1] ?? trimmed;
}

function looksLikeFile(segment: string) {
  const trimmed = segment.trim();
  if (!trimmed) {
    return false;
  }

  const name = basename(trimmed);
  return FILE_EXTENSION_PATTERN.test(name) || trimmed.includes('/');
}

function extractBranch(value: string): { label: string; branch: string | null } {
  const match = value.trim().match(/^(.+?)\s+\(([^)]+)\)$/);
  if (!match) {
    return { label: value.trim(), branch: null };
  }

  return {
    label: match[1]!.trim(),
    branch: match[2]!.trim(),
  };
}

function stripSuffixParts(parts: string[], suffixes: Set<string>) {
  const last = parts[parts.length - 1]?.trim().toLowerCase();
  if (last && suffixes.has(last)) {
    return parts.slice(0, -1);
  }

  return parts;
}

function bundleIncludes(block: ActivityBlockListRow, value: string) {
  return block.bundleId.trim().toLowerCase().includes(value);
}

function appIncludes(block: ActivityBlockListRow, value: string) {
  return block.appName.trim().toLowerCase().includes(value);
}

export function isIdeApp(block: ActivityBlockListRow): boolean {
  return (
    bundleIncludes(block, 'cursor') ||
    bundleIncludes(block, 'todesktop') ||
    bundleIncludes(block, 'vscode') ||
    appIncludes(block, 'cursor') ||
    appIncludes(block, 'visual studio code')
  );
}

export function isDesignApp(block: ActivityBlockListRow): boolean {
  return (
    bundleIncludes(block, 'figma') ||
    bundleIncludes(block, 'illustrator') ||
    appIncludes(block, 'figma') ||
    appIncludes(block, 'illustrator')
  );
}

export function isDocumentApp(block: ActivityBlockListRow): boolean {
  return bundleIncludes(block, 'microsoft.word') || appIncludes(block, 'word');
}

export function isEmailApp(block: ActivityBlockListRow): boolean {
  return (
    bundleIncludes(block, 'mail') ||
    bundleIncludes(block, 'outlook') ||
    bundleIncludes(block, 'spark') ||
    bundleIncludes(block, 'airmail') ||
    bundleIncludes(block, 'mimestream') ||
    appIncludes(block, 'mail') ||
    appIncludes(block, 'outlook') ||
    appIncludes(block, 'spark') ||
    appIncludes(block, 'airmail') ||
    appIncludes(block, 'mimestream') ||
    appIncludes(block, 'superhuman')
  );
}

function googleWorkspaceKindFromDomain(
  domain: string | null,
): 'document' | null {
  const normalized = domain?.trim().toLowerCase() ?? '';
  if (
    normalized === 'docs.google.com' ||
    normalized === 'sheets.google.com' ||
    normalized === 'slides.google.com'
  ) {
    return 'document';
  }

  return null;
}

function googleWorkspaceLabelFromDomain(domain: string | null): string | null {
  switch (domain?.trim().toLowerCase()) {
    case 'docs.google.com':
      return 'Google Docs';
    case 'sheets.google.com':
      return 'Google Sheets';
    case 'slides.google.com':
      return 'Google Slides';
    default:
      return null;
  }
}

function parseIdeContext(title: string): ActivityAppContext | null {
  const parts = stripSuffixParts(splitTitleParts(title), IDE_SUFFIXES);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    const { label, branch } = extractBranch(parts[0]!);
    return {
      kind: 'ide',
      item: label,
      detail: null,
      meta: branch,
      context: null,
    };
  }

  const fileIndex = parts.findIndex(looksLikeFile);

  if (fileIndex >= 0) {
    const detail = basename(parts[fileIndex]!);
    const remaining = parts.filter((_, index) => index !== fileIndex);
    const itemCandidate =
      remaining.find((part) => !looksLikeFile(part)) ?? remaining[0] ?? '';
    const { label, branch } = extractBranch(itemCandidate);
    const contextParts = remaining.filter((part) => part !== itemCandidate);

    return {
      kind: 'ide',
      item: label || null,
      detail,
      meta: branch,
      context: contextParts.length > 0 ? contextParts.join(' · ') : null,
    };
  }

  const { label, branch } = extractBranch(parts[0]!);

  return {
    kind: 'ide',
    item: label,
    detail: null,
    meta: branch,
    context: parts.slice(1).join(' · ') || null,
  };
}

function parseDesignContext(
  block: ActivityBlockListRow,
  title: string,
): ActivityAppContext | null {
  if (bundleIncludes(block, 'illustrator') || appIncludes(block, 'illustrator')) {
    const illustratorMatch = title.match(
      /^(.+?\.ai)(?:\s*@\s*\d+(?:\.\d+)?%)?(?:\s*\(([^)]+)\))?/i,
    );

    if (illustratorMatch) {
      return {
        kind: 'design',
        item: basename(illustratorMatch[1]!),
        detail: illustratorMatch[2]?.trim() ?? null,
        meta: null,
        context: null,
      };
    }
  }

  const parts = stripSuffixParts(splitTitleParts(title), DESIGN_SUFFIXES);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    return {
      kind: 'design',
      item: parts[0]!,
      detail: null,
      meta: null,
      context: null,
    };
  }

  return {
    kind: 'design',
    item: parts[parts.length - 1]!,
    detail: parts.slice(0, -1).join(' · '),
    meta: null,
    context: null,
  };
}

function parseDocumentContext(title: string): ActivityAppContext | null {
  const parts = stripSuffixParts(splitTitleParts(title), DOCUMENT_SUFFIXES);
  if (parts.length === 0) {
    return null;
  }

  return {
    kind: 'document',
    item: parts[0]!,
    detail: parts.length > 1 ? parts.slice(1).join(' · ') : null,
    meta: null,
    context: null,
  };
}

function parseGoogleWorkspaceContext(
  block: ActivityBlockListRow,
  title: string,
): ActivityAppContext | null {
  const parts = stripSuffixParts(
    splitTitleParts(title),
    GOOGLE_WORKSPACE_SUFFIXES,
  );

  const workspaceLabel =
    googleWorkspaceLabelFromDomain(block.domain) ??
    parts[parts.length - 1] ??
    null;

  if (parts.length === 0) {
    if (!googleWorkspaceKindFromDomain(block.domain)) {
      return null;
    }

    return {
      kind: 'document',
      item: workspaceLabel,
      detail: null,
      meta: null,
      context: null,
    };
  }

  const item = parts[0]!;
  const detail =
    parts.length > 1
      ? parts.slice(1).join(' · ')
      : googleWorkspaceLabelFromDomain(block.domain);

  return {
    kind: 'document',
    item,
    detail: detail || null,
    meta: googleWorkspaceLabelFromDomain(block.domain),
    context: null,
  };
}

function emailMetaFromSubject(subject: string): string | null {
  if (/^new message\b/i.test(subject) || /^draft\b/i.test(subject)) {
    return 'Compose';
  }

  if (/^(re|fwd|fw):/i.test(subject)) {
    return 'Reply';
  }

  return null;
}

function parseEmailContext(title: string): ActivityAppContext | null {
  const parts = stripSuffixParts(splitTitleParts(title), EMAIL_SUFFIXES);
  if (parts.length === 0) {
    return null;
  }

  const joined = parts.join(' - ').trim().toLowerCase();
  if (GENERIC_APP_TITLES.has(joined) || GENERIC_APP_TITLES.has(parts[0]!.toLowerCase())) {
    return null;
  }

  const subject = parts[0]!;
  const detail = parts.length > 1 ? parts.slice(1).join(' · ') : null;

  return {
    kind: 'email',
    item: subject,
    detail,
    meta: emailMetaFromSubject(subject),
    context: null,
  };
}

function parseBrowserContext(
  block: ActivityBlockListRow,
  title: string,
): ActivityAppContext | null {
  const googleContext = parseGoogleWorkspaceContext(block, title);
  if (googleContext) {
    return googleContext;
  }

  const domain = block.domain?.trim();
  if (!domain || !title) {
    return null;
  }

  const parts = splitTitleParts(title);
  if (parts.length === 0) {
    return null;
  }

  const last = parts[parts.length - 1]?.toLowerCase();
  if (last === domain.toLowerCase()) {
    return {
      kind: 'browser',
      item: parts.slice(0, -1).join(' - ') || parts[0]!,
      detail: domain,
      meta: null,
      context: null,
    };
  }

  return {
    kind: 'browser',
    item: parts[0]!,
    detail: parts.length > 1 ? parts.slice(1).join(' · ') : domain,
    meta: null,
    context: null,
  };
}

export function parseActivityAppContext(
  block: ActivityBlockListRow,
): ActivityAppContext | null {
  const title = block.windowTitle.trim();
  if (!title) {
    return null;
  }

  if (isIdeApp(block)) {
    return parseIdeContext(title);
  }

  if (isEmailApp(block) || block.domain?.trim().toLowerCase() === 'mail.google.com') {
    const emailContext = parseEmailContext(title);
    if (emailContext) {
      return emailContext;
    }
  }

  if (isDesignApp(block)) {
    return parseDesignContext(block, title);
  }

  if (isDocumentApp(block)) {
    return parseDocumentContext(title);
  }

  if (
    googleWorkspaceKindFromDomain(block.domain) ||
    GOOGLE_WORKSPACE_SUFFIXES.has(title.toLowerCase()) ||
    splitTitleParts(title).some((part) =>
      GOOGLE_WORKSPACE_SUFFIXES.has(part.toLowerCase()),
    )
  ) {
    return parseGoogleWorkspaceContext(block, title);
  }

  if (block.domain || appIncludes(block, 'safari') || appIncludes(block, 'chrome')) {
    return parseBrowserContext(block, title);
  }

  return null;
}

export type ActivityRuleMatchLevel =
  | 'page'
  | 'url'
  | 'domain'
  | 'app'
  | 'file'
  | 'project';

export type ActivityRuleMatch = {
  matchType: 'domain' | 'app_name' | 'title_contains' | 'url_path';
  matchValue: string;
  label: string;
  level: ActivityRuleMatchLevel;
  description: string;
};

export function activityRuleMatchKey(match: ActivityRuleMatch): string {
  return `${match.matchType}::${match.matchValue}`;
}

export function findActivityRuleMatchByKey(
  options: ActivityRuleMatch[],
  key: string,
): ActivityRuleMatch | null {
  return options.find((option) => activityRuleMatchKey(option) === key) ?? null;
}

function isGenericRememberLabel(
  value: string,
  block: ActivityBlockListRow,
): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3) {
    return true;
  }

  if (GENERIC_APP_TITLES.has(normalized)) {
    return true;
  }

  if (normalized === block.appName.trim().toLowerCase()) {
    return true;
  }

  return false;
}

function ruleLabelForContext(
  context: ActivityAppContext,
  matchValue: string,
): string {
  if (context.kind === 'ide' && context.detail) {
    return `${matchValue} project`;
  }

  if (context.kind === 'design' && context.detail && !context.detail.includes('/')) {
    return `${matchValue} · ${context.detail}`;
  }

  return matchValue;
}

function normalizeUrlForRule(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path =
      parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

function browserTitleMatchesDomain(item: string, domain: string): boolean {
  const itemNorm = item.trim().toLowerCase();
  const domainNorm = domain.trim().toLowerCase().replace(/^www\./, '');
  const siteName = domainNorm.split('.')[0] ?? domainNorm;

  return itemNorm === siteName || itemNorm === domainNorm;
}

export function getActivityRuleMatchOptions(
  block: ActivityBlockListRow,
): ActivityRuleMatch[] {
  const options: ActivityRuleMatch[] = [];
  const seen = new Set<string>();

  function add(option: ActivityRuleMatch) {
    const key = `${option.matchType}:${option.matchValue.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    options.push(option);
  }

  const context = parseActivityAppContext(block);
  const domain = block.domain?.trim().toLowerCase();
  const normalizedUrl = block.url?.trim()
    ? normalizeUrlForRule(block.url.trim())
    : null;

  if (context && context.kind !== 'email' && context.item?.trim()) {
    const item = context.item.trim();
    const preferDomain =
      domain != null && browserTitleMatchesDomain(item, domain);

    if (!preferDomain && !isGenericRememberLabel(item, block)) {
      const level: ActivityRuleMatchLevel =
        context.kind === 'ide'
          ? 'project'
          : context.kind === 'design'
            ? 'file'
            : 'page';

      const description =
        level === 'project'
          ? 'This repo or workspace'
          : level === 'file'
            ? 'This file'
            : 'This page title';

      add({
        matchType: 'title_contains',
        matchValue: item,
        label: ruleLabelForContext(context, item),
        level,
        description,
      });
    }
  }

  if (normalizedUrl?.includes('/')) {
    add({
      matchType: 'url_path',
      matchValue: normalizedUrl,
      label: normalizedUrl,
      level: 'url',
      description: 'This URL path',
    });
  }

  if (domain) {
    add({
      matchType: 'domain',
      matchValue: domain,
      label: domain,
      level: 'domain',
      description: 'All pages on this website',
    });
  }

  const appName = block.appName.trim();
  if (appName) {
    add({
      matchType: 'app_name',
      matchValue: appName,
      label: appName,
      level: 'app',
      description: 'All sessions in this app',
    });
  }

  return options;
}

export function intersectActivityRuleMatchOptions(
  blocks: ActivityBlockListRow[],
): ActivityRuleMatch[] {
  if (blocks.length === 0) {
    return [];
  }

  const optionSets = blocks.map(getActivityRuleMatchOptions);
  const [firstSet, ...restSets] = optionSets;

  return (firstSet ?? []).filter((option) =>
    restSets.every((set) =>
      set.some(
        (candidate) =>
          candidate.matchType === option.matchType &&
          candidate.matchValue === option.matchValue,
      ),
    ),
  );
}

export function inferActivityRuleMatch(
  block: ActivityBlockListRow,
): ActivityRuleMatch | null {
  return getActivityRuleMatchOptions(block)[0] ?? null;
}

export function blockContextLabel(block: ActivityBlockListRow): string {
  const context = parseActivityAppContext(block);

  if (!context) {
    const title = block.windowTitle.trim();
    if (title) {
      return title;
    }

    if (block.domain) {
      return block.domain;
    }

    return block.appName;
  }

  if (context.context) {
    return context.context;
  }

  if (context.kind === 'ide' && context.item && !context.detail) {
    return 'Workspace';
  }

  if (context.kind === 'email' && context.meta) {
    return context.meta;
  }

  if (context.meta && context.kind === 'document') {
    return context.meta;
  }

  return block.windowTitle.trim() || block.appName;
}

/** @deprecated Use parseActivityAppContext */
export function parseIdeWindowContext(block: ActivityBlockListRow) {
  const context = parseActivityAppContext(block);
  if (!context || context.kind !== 'ide') {
    return null;
  }

  return {
    repo: context.item,
    file: context.detail,
    branch: context.meta,
    context: context.context,
  };
}
