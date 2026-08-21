'use client';

import { useCallback, useEffect, useState } from 'react';

import { ArchiveRestore, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  destroyClient,
  listClients,
  restoreClient,
} from '../_lib/server/server-actions';

type ArchivedClient = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  archived_at: string | null;
};

export function ArchivedClientsList({
  accountId,
  canEditClients,
  onRestored,
  terminology = 'default',
}: {
  accountId: string;
  canEditClients: boolean;
  onRestored?: () => void;
  terminology?: 'default' | 'commercial';
}) {
  const isCommercial = terminology === 'commercial';
  const entity = isCommercial ? 'contact' : 'client';
  const entityPlural = isCommercial ? 'contacts' : 'clients';
  const entityTitle = isCommercial ? 'Contact' : 'Client';

  const [clients, setClients] = useState<ArchivedClient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedClient | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listClients({
        accountId,
        archived: true,
        page: 1,
        pageSize: 100,
      });
      setClients((result?.data ?? []) as ArchivedClient[]);
      setTotal(result?.total ?? 0);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : `Failed to load archived ${entityPlural}`,
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, entityPlural]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = async (client: ArchivedClient) => {
    setBusyId(client.id);
    try {
      await restoreClient({ accountId, clientId: client.id });
      toast.success(`${client.display_name ?? entityTitle} restored`);
      setClients((current) => current.filter((c) => c.id !== client.id));
      onRestored?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `Failed to restore ${entity}`,
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDestroy = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setDeleteTarget(null);
    try {
      await destroyClient({ accountId, clientId: target.id });
      toast.success(
        `${target.display_name ?? entityTitle} permanently deleted`,
      );
      setClients((current) => current.filter((c) => c.id !== target.id));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `Failed to delete ${entity}`,
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Loading archived {entityPlural}…
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        No archived {entityPlural}. Archived {entityPlural} can be restored or
        permanently deleted from here.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40">
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {client.display_name ?? client.company_name ?? 'Unnamed'}
                </p>
                <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                  {[
                    client.company_name &&
                    client.company_name !== client.display_name
                      ? client.company_name
                      : null,
                    client.email,
                    client.archived_at
                      ? `Archived ${new Date(client.archived_at).toLocaleDateString()}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>

              {canEditClients ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-xs text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]"
                    disabled={busyId === client.id}
                    onClick={() => handleRestore(client)}
                  >
                    <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[color:#C4455C]/40 bg-transparent text-xs text-[#C4455C] hover:bg-[#C4455C]/10"
                    disabled={busyId === client.id}
                    onClick={() => setDeleteTarget(client)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete permanently
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {total > clients.length ? (
        <p className="mt-3 text-center text-xs text-[var(--workspace-shell-text-muted)]">
          Showing the {clients.length} most recent of {total} archived{' '}
          {entityPlural}.
        </p>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete{' '}
              {deleteTarget?.display_name ?? `this ${entity}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCommercial
                ? 'This cannot be undone. Their notes and people records will be deleted with them. Linked disposals, requirements and viewings are kept but will no longer be linked to this contact.'
                : 'This cannot be undone. Their notes, contacts and meeting transcripts will be deleted with them. Projects, tasks, documents, proposals and emails are kept but will no longer be linked to a client. Clients with invoices cannot be deleted — invoices are kept as financial records.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#C4455C] text-white hover:bg-[#C4455C]/90"
              onClick={handleDestroy}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
