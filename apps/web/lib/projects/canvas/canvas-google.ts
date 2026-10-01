/**
 * Google Docs, Sheets, Slides and Forms links, turned into URLs that can sit in
 * an iframe on the canvas. Google decides who can see or edit a file: the
 * embed just shows what the signed-in Google account is allowed to.
 */

export type GoogleDocKind = 'doc' | 'sheet' | 'slides' | 'form';

export type GoogleDocEmbed = {
  kind: GoogleDocKind;
  id: string;
  label: string;
  /** Read-only view, safe to leave running on the canvas. */
  previewUrl: string;
  /** Full editor with the minimum of Google chrome. */
  editUrl: string;
  /** The normal Google link, for "open in Google". */
  openUrl: string;
};

const LABELS: Record<GoogleDocKind, string> = {
  doc: 'Google Doc',
  sheet: 'Google Sheet',
  slides: 'Google Slides',
  form: 'Google Form',
};

const PATHS: Record<Exclude<GoogleDocKind, 'form'>, string> = {
  doc: 'document',
  sheet: 'spreadsheets',
  slides: 'presentation',
};

const FILE_PATH =
  /^\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([\w-]{20,})(?:\/|$)/;
const FORM_PATH = /^\/forms\/(?:u\/\d+\/)?d\/(e\/)?([\w-]{20,})(?:\/|$)/;

const KIND_BY_PATH: Record<string, Exclude<GoogleDocKind, 'form'>> = {
  document: 'doc',
  spreadsheets: 'sheet',
  presentation: 'slides',
};

export function googleDocLabel(kind: GoogleDocKind): string {
  return LABELS[kind];
}

/** The embed details for a Google Docs/Sheets/Slides/Forms link, else null. */
export function parseGoogleDoc(
  raw: string | undefined | null,
): GoogleDocEmbed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
    return null;
  }

  const form = FORM_PATH.exec(url.pathname);
  if (form) {
    const published = Boolean(form[1]);
    const base = `https://docs.google.com/forms/d/${published ? 'e/' : ''}${form[2]}`;
    const fill = `${base}/viewform?embedded=true`;
    return {
      kind: 'form',
      id: form[2]!,
      label: LABELS.form,
      previewUrl: fill,
      // Published forms have no editor link to guess, so they open the form.
      editUrl: published ? fill : `${base}/edit`,
      openUrl: published ? `${base}/viewform` : `${base}/edit`,
    };
  }

  const file = FILE_PATH.exec(url.pathname);
  if (!file) return null;
  const kind = KIND_BY_PATH[file[1]!]!;
  const id = file[2]!;
  const base = `https://docs.google.com/${PATHS[kind]}/d/${id}`;
  // Keep the chosen sheet tab: `#gid=123` (or `?gid=123`).
  const gid =
    /gid=(\d+)/.exec(url.hash)?.[1] ?? url.searchParams.get('gid') ?? null;
  const tab = gid && /^\d+$/.test(gid) ? `#gid=${gid}` : '';

  return {
    kind,
    id,
    label: LABELS[kind],
    previewUrl: `${base}/preview${kind === 'sheet' && gid ? `?gid=${gid}` : ''}`,
    editUrl: `${base}/edit?rm=minimal${tab}`,
    openUrl: `${base}/edit${tab}`,
  };
}
