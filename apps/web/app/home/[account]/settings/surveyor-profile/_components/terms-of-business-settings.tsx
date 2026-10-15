'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { saveSurveyorTobSettingsAction } from '../../../surveys/_lib/server/survey-report-details-actions';

export function TermsOfBusinessSettings({
  accountId,
  accountSlug,
  initialSignatoryName,
  initialSignatoryTitle,
  initialSignatureType,
  initialSignatureData,
}: {
  accountId: string;
  accountSlug: string;
  initialSignatoryName: string | null;
  initialSignatoryTitle: string | null;
  initialSignatureType: string | null;
  initialSignatureData: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialSignatoryName ?? '');
  const [title, setTitle] = useState(initialSignatoryTitle ?? '');
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed'>(
    initialSignatureType === 'typed' ? 'typed' : 'drawn',
  );
  const [signatureData, setSignatureData] = useState(
    initialSignatureData ?? '',
  );

  return (
    <div className={`${workspacePanelCard} space-y-4 p-5`}>
      <div>
        <h2 className={`text-base font-semibold ${workspaceText}`}>
          Terms of business
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Saved once and applied automatically when you send terms from the
          Booked popup.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tob-name">Signatory name</Label>
          <Input
            id="tob-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ben Carey MRICS"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tob-title">Title</Label>
          <Input
            id="tob-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Partner | Chartered Building Surveyor"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tob-signature">Signature</Label>
        <p className={`text-xs ${workspaceTextMuted}`}>
          Paste a typed name, or a data URL from a drawn signature pad.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={signatureType === 'typed' ? 'default' : 'outline'}
            onClick={() => setSignatureType('typed')}
          >
            Typed
          </Button>
          <Button
            type="button"
            size="sm"
            variant={signatureType === 'drawn' ? 'default' : 'outline'}
            onClick={() => setSignatureType('drawn')}
          >
            Drawn (data URL)
          </Button>
        </div>
        <Textarea
          id="tob-signature"
          rows={3}
          value={signatureData}
          onChange={(event) => setSignatureData(event.target.value)}
          placeholder={
            signatureType === 'typed'
              ? 'Ben Carey'
              : 'data:image/png;base64,…'
          }
        />
      </div>
      <Button
        type="button"
        className={workspaceBtnPrimaryMd}
        disabled={pending || !name.trim() || !signatureData.trim()}
        onClick={() => {
          startTransition(async () => {
            try {
              await saveSurveyorTobSettingsAction({
                accountId,
                accountSlug,
                tobSignatoryName: name.trim(),
                tobSignatoryTitle: title.trim() || null,
                tobSignatureType: signatureType,
                tobSignatureData: signatureData.trim(),
              });
              toast.success('Terms of business signature saved');
              router.refresh();
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          });
        }}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save signature
      </Button>
    </div>
  );
}
