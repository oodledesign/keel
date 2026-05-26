export type WorkspaceNotesVariant = 'work' | 'property' | 'family' | 'community';

export type WorkspaceDocsVariant = WorkspaceNotesVariant;

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
  tags: string[];
  projectId: string | null;
  jobId: string | null;
  clientOrgId: string | null;
  clientId: string | null;
  propertyId: string | null;
  taskId: string | null;
  context: NoteContextLink | null;
  updatedAt: string;
  createdAt: string;
};

export type DocListItem = {
  id: string;
  title: string;
  content: string | null;
  kind: 'written' | 'uploaded';
  docType: string | null;
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
  'insurance',
  'inspection',
  'title_deed',
  'mortgage',
  'tax',
  'template',
  'other',
] as const;

export type DocTypeOption = (typeof DOC_TYPE_OPTIONS)[number];
