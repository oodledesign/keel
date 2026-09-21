'use client';

import { useEffect, useState, useTransition } from 'react';

import { toast } from '@kit/ui/sonner';

import { RetainerServiceListEditor } from '~/components/retainers/retainer-service-list-editor';
import type {
  CatalogueService,
  EffectiveService,
  EffectiveServiceList,
  ServiceCategory,
} from '~/lib/retainers/effective-services';
import { clientInheritanceLabel } from '~/lib/retainers/effective-services';

import {
  addCustomClientRetainerServiceAction,
  loadClientRetainerServicesAction,
  replaceClientRetainerServicesAction,
  resetClientRetainerServicesAction,
} from '../_lib/server/client-retainer-services-actions';

export function ClientRetainerServicesPanel({
  accountId,
  clientId,
  canEdit,
}: {
  accountId: string;
  clientId: string;
  canEdit: boolean;
}) {
  const [list, setList] = useState<EffectiveServiceList | null>(null);
  const [library, setLibrary] = useState<CatalogueService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadClientRetainerServicesAction({ accountId, clientId })
      .then((data) => {
        if (cancelled) return;
        setList(data.list);
        setLibrary(data.library);
        setCategories(data.categories);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not load client services',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, clientId]);

  function apply(data: {
    list: EffectiveServiceList;
    library: CatalogueService[];
    categories: ServiceCategory[];
  }) {
    setList(data.list);
    setLibrary(data.library);
    setCategories(data.categories);
  }

  function replaceServices(services: EffectiveService[]) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const data = await replaceClientRetainerServicesAction({
          accountId,
          clientId,
          services: services.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            creditCost: row.creditCost,
            requestTypeId: row.requestTypeId,
            isActive: row.isActive,
            isVisible: row.isVisible,
            sortOrder: row.sortOrder,
          })),
        });
        apply(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update services',
        );
      }
    });
  }

  function resetServices() {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const data = await resetClientRetainerServicesAction({
          accountId,
          clientId,
        });
        apply(data);
        toast.success('Reset to workspace library');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not reset services',
        );
      }
    });
  }

  function addCustom(input: {
    name: string;
    description: string | null;
    creditCost: number;
    categoryId?: string | null;
    isVisible?: boolean;
  }) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const data = await addCustomClientRetainerServiceAction({
          accountId,
          clientId,
          ...input,
        });
        apply(data);
        toast.success('Custom service added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add service',
        );
      }
    });
  }

  if (loading) {
    return (
      <p className="mt-6 text-sm text-[var(--workspace-shell-text-muted)]">
        Loading services…
      </p>
    );
  }

  if (!list) return null;

  return (
    <div className="mt-6 space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Manage services
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          This list seeds every new project under this client. Projects can
          still override it.
        </p>
      </div>
      <RetainerServiceListEditor
        services={list.services}
        library={library}
        categories={categories}
        inheritanceLabel={clientInheritanceLabel(list.source === 'client')}
        resetLabel="Reset to workspace library"
        customized={list.source === 'client'}
        canEdit={canEdit}
        pending={pending}
        emptyHint="No services for this client yet. Add from the workspace library or create a custom one."
        onReplace={replaceServices}
        onReset={resetServices}
        onAddCustom={addCustom}
      />
    </div>
  );
}
