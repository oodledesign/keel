'use client';

import { useEffect, useState } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';

import { ClientCombobox } from './client-combobox';
import { getErrorMessage } from '../_lib/error-message';

import { createJob } from '../_lib/server/server-actions';

export function CreateJobSheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('pending');
  const [priority, setPriority] = useState<string>('medium');
  const [dueDate, setDueDate] = useState('');
  const [valuePence, setValuePence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<{ id: string; display_name: string | null }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  useEffect(() => {
    if (!open || !accountId) return;
    setClientsLoading(true);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        const raw = r as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClients((list || []) as { id: string; display_name: string | null }[]);
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [open, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSubmitting(true);
    try {
      await createJob({
        accountId,
        title: title.trim(),
        description: description.trim() || undefined,
        client_id: clientId.trim() || undefined,
        status: status as 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled',
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: dueDate ? new Date(dueDate) : undefined,
        value_pence: valuePence ? Math.round(parseFloat(valuePence) * 100) : undefined,
      });
      toast.success('Job created');
      setTitle('');
      setClientId('');
      setDescription('');
      setStatus('pending');
      setPriority('medium');
      setDueDate('');
      setValuePence('');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-zinc-700 bg-[var(--workspace-shell-panel)] text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Create job</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <Label htmlFor="title" className="text-zinc-300">
              Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 border-zinc-600 bg-zinc-800 text-white"
              placeholder="Job title"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Client</Label>
            <div className="mt-1">
              <ClientCombobox
                clients={clients}
                value={clientId}
                onValueChange={setClientId}
                loading={clientsLoading}
                placeholder="Select client"
                addClientHref={pathsConfig.app.accountClients.replace('[account]', accountSlug)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description" className="text-zinc-300">
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500"
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-300">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 border-zinc-600 bg-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-300">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1 border-zinc-600 bg-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="due_date" className="text-zinc-300">
              Due date
            </Label>
            <Input
              id="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 border-zinc-600 bg-zinc-800 text-white"
            />
          </div>
          <div>
            <Label htmlFor="value" className="text-zinc-300">
              Value (£)
            </Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={valuePence}
              onChange={(e) => setValuePence(e.target.value)}
              className="mt-1 border-zinc-600 bg-zinc-800 text-white"
              placeholder="0.00"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {submitting ? 'Creating...' : 'Create job'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 text-zinc-300"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
