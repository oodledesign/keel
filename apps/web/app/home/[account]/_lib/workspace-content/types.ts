export type WorkspaceNotesVariant =
  | 'work'
  | 'property'
  | 'family'
  | 'community';

export type WorkspaceDocsVariant = WorkspaceNotesVariant;

export const NOTE_FILE_CATEGORY_OPTIONS = [
  'meeting_transcript',
  'idea',
  'future',
  'development',
] as const;

export type NoteFileCategory = (typeof NOTE_FILE_CATEGORY_OPTIONS)[number];

/** Stored slug on notes.category — system or custom per account. */
export type NoteCategorySlug = string;

export const NOTE_FILE_CATEGORY_LABELS: Record<NoteFileCategory, string> = {
  meeting_transcript: 'Meeting transcript',
  idea: 'Idea',
  future: 'Future',
  development: 'Development',
};

export type CustomNoteCategory = {
  slug: string;
  label: string;
};

export function getNoteCategoryLabel(
  slug: string,
  customCategories: CustomNoteCategory[] = [],
): string {
  if (slug in NOTE_FILE_CATEGORY_LABELS) {
    return NOTE_FILE_CATEGORY_LABELS[slug as NoteFileCategory];
  }

  const custom = customCategories.find((c) => c.slug === slug);
  if (custom) return custom.label;

  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type NoteContextLink = {
  type: 'project' | 'client' | 'property' | 'task' | 'job';
  id: string;
  label: string;
};

export type NoteListItem = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  category: NoteFileCategory;
  tags: string[];
  folderId: string | null;
  projectId: string | null;
  jobId: string | null;
  clientOrgId: string | null;
  clientId: string | null;
  propertyId: string | null;
  taskId: string | null;
  context: NoteContextLink | null;
  isPublic: boolean;
  publicToken: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ProposalContextRef = {
  type: 'note' | 'file';
  id: string;
  title: string;
};

export type DocListItem = {
  id: string;
  title: string;
  content: string | null;
  kind: 'written' | 'uploaded';
  docType: string | null;
  category: NoteFileCategory;
  isPinned: boolean;
  tags: string[];
  projectId: string | null;
  jobId: string | null;
  clientOrgId: string | null;
  clientId: string | null;
  propertyId: string | null;
  taskId: string | null;
  context: NoteContextLink | null;
  mimeType: string | null;
  fileUrl: string | null;
  filePath: string | null;
  fileSizeBytes: number | null;
  financialYear: string | null;
  storageBucket: string;
  isPublic: boolean;
  publicToken: string | null;
  updatedAt: string;
};

export type LinkOption = {
  type: 'project' | 'client' | 'property' | 'task' | 'job';
  id: string;
  label: string;
};

export const DOC_TYPE_OPTIONS = [
  'general',
  'contract',
  'lease',
  'ast',
  'insurance',
  'inspection',
  'title_deed',
  'mortgage',
  'tax',
  'template',
  'utility',
  'photo',
  'other',
] as const;

export type DocTypeOption = (typeof DOC_TYPE_OPTIONS)[number];

export const DOC_TYPE_LABELS: Record<DocTypeOption, string> = {
  general: 'General',
  contract: 'Contract',
  lease: 'Lease',
  ast: 'AST',
  insurance: 'Insurance',
  inspection: 'Inspection',
  title_deed: 'Title deed',
  mortgage: 'Mortgage',
  tax: 'Tax',
  template: 'Template',
  utility: 'Utility',
  photo: 'Photo',
  other: 'Other',
};

export function getDocTypeLabel(
  docType: string | null | undefined,
): string | null {
  if (!docType) return null;
  if (docType in DOC_TYPE_LABELS) {
    return DOC_TYPE_LABELS[docType as DocTypeOption];
  }
  return docType.replace(/_/g, ' ');
}

export function isPreviewableMimeType(
  mimeType: string | null | undefined,
): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/x-pdf'
  );
}
