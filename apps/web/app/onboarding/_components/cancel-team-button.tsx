'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';

import { deleteTeamAccountFromOnboarding } from '../_lib/server/onboarding.actions';

export function CancelTeamButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await deleteTeamAccountFromOnboarding(accountId);
      if (result?.error) {
        setLoading(false);
        return;
      }
      setOpen(false);
      router.push('/home');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Cancel this team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel and delete this team?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{accountName}</strong> and all
            its data. You can’t undo this.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Keep team
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting…' : 'Delete team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
