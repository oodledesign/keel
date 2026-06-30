'use client';

import { useCallback, useRef, useState, useTransition } from 'react';

import { FileText, Paperclip, Pencil, Trash2, Upload } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { DOCUMENT_TYPE_LABELS } from '../../_lib/document-types';
import type { PropertyDocument } from '../../_lib/server/properties.service';
import {
  createDocument,
  deleteDocument,
} from '../../_lib/server/server-actions';
import { PropertyDocumentEditModal } from './property-document-edit-modal';

interface PropertyDocumentsTabProps {
  propertyId: string;
  accountId: string;
  userId: string;
  initialDocuments: PropertyDocument[];
}

const DOCTYPE_LABELS: Record<string, string> = DOCUMENT_TYPE_LABELS;

export function PropertyDocumentsTab({
  propertyId,
  accountId,
  userId,
  initialDocuments,
}: PropertyDocumentsTabProps) {
  const [documents, setDocuments] = useState<PropertyDocument[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>('other');
  const [error, setError] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<PropertyDocument | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useSupabase();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // 50 MB limit (matches bucket config)
      if (file.size > 50 * 1024 * 1024) {
        setError('File is too large. Maximum size is 50 MB.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setError(null);
      setUploading(true);

      try {
        // Upload to storage
        const filePath = `${accountId}/${propertyId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('property-documents')
          .upload(filePath, file, { upsert: false });

        if (uploadError) throw uploadError;

        // Create DB record
        const newDoc = await createDocument({
          propertyId,
          accountId,
          uploadedBy: userId,
          name: file.name,
          filePath,
          fileSize: file.size,
          mimeType: file.type || null,
          documentType: docType,
        });

        if (newDoc) {
          setDocuments((prev) => [newDoc, ...prev]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [supabase, propertyId, accountId, userId, docType],
  );

  const handleDelete = useCallback(
    (doc: PropertyDocument) => {
      if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
      startTransition(async () => {
        try {
          // Delete DB record first — if storage removal fails, the orphaned file
          // is recoverable; the reverse leaves a permanent orphaned DB record.
          await deleteDocument({ documentId: doc.id });
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
          // Remove from storage (best-effort; logged on failure)
          const { error: storageError } = await supabase.storage
            .from('property-documents')
            .remove([doc.filePath]);
          if (storageError) {
            console.warn('[property-documents] Storage removal failed for', doc.filePath, storageError.message);
          }
        } catch (err) {
          console.error(err);
        }
      });
    },
    [supabase],
  );

  const handleDownload = useCallback(
    async (doc: PropertyDocument) => {
      const { data } = await supabase.storage
        .from('property-documents')
        .createSignedUrl(doc.filePath, 60);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    },
    [supabase],
  );

  return (
    <div className="space-y-5">
      {/* Upload strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-4 sm:flex-row sm:items-center">
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="w-[160px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DOCTYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          className="gap-2 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 hover:text-[var(--workspace-shell-text)]"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading…' : 'Upload document'}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-500/15 px-4 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Paperclip className="mb-3 h-10 w-10 text-[var(--workspace-shell-text)]/20" />
          <p className="text-sm text-[var(--workspace-shell-text)]/50">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-4 py-3"
            >
              <FileText className="h-5 w-5 flex-shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  className="truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-violet-300 transition-colors text-left"
                >
                  {doc.name}
                </button>
                <p className="text-xs text-[var(--workspace-shell-text)]/40">
                  {DOCTYPE_LABELS[doc.documentType] ?? doc.documentType}
                  {doc.financialYear ? ` · FY ${doc.financialYear}` : ''}
                  {doc.fileSize
                    ? ` · ${formatBytes(doc.fileSize)}`
                    : ''}
                  {` · ${formatDate(doc.createdAt)}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 text-[var(--workspace-shell-text)]/30 hover:text-[var(--workspace-shell-text)]"
                onClick={() => setEditingDoc(doc)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 text-[var(--workspace-shell-text)]/30 hover:text-rose-400"
                onClick={() => handleDelete(doc)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <PropertyDocumentEditModal
        open={Boolean(editingDoc)}
        doc={editingDoc}
        onClose={() => setEditingDoc(null)}
        onSaved={(updated) => {
          setDocuments((prev) =>
            prev.map((d) => (d.id === updated.id ? updated : d)),
          );
          setEditingDoc(null);
        }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
