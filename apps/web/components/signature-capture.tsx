'use client';

import { useCallback, useRef, useState } from 'react';

import { Loader2, PenLine, Type, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

export type SignatureCaptureResult = {
  signature_type: 'typed' | 'drawn' | 'uploaded';
  signature_data: string;
};

export function SignatureCapture({
  defaultName = '',
  onConfirm,
  onCancel,
  loading = false,
}: {
  defaultName?: string;
  onConfirm: (result: SignatureCaptureResult) => void;
  onCancel?: () => void;
  loading?: boolean;
}) {
  const [typedName, setTypedName] = useState(defaultName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getDrawnDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = typeof reader.result === 'string' ? reader.result : '';
        if (data) onConfirm({ signature_type: 'uploaded', signature_data: data });
      };
      reader.readAsDataURL(file);
    },
    [onConfirm],
  );

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <Tabs defaultValue="typed">
        <TabsList>
          <TabsTrigger value="typed">
            <Type className="mr-1 h-4 w-4" />
            Typed
          </TabsTrigger>
          <TabsTrigger value="drawn">
            <PenLine className="mr-1 h-4 w-4" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="mr-1 h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="typed" className="mt-4 space-y-3">
          <div>
            <Label>Type your name</Label>
            <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} />
          </div>
          {typedName.trim() ? (
            <div className="rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] px-4 py-6 text-center">
              <p className="font-serif text-3xl text-[#0f172a]" style={{ fontFamily: 'Georgia, serif' }}>
                {typedName}
              </p>
            </div>
          ) : null}
          <Button
            disabled={!typedName.trim() || loading}
            className="bg-[var(--ozer-accent)] text-[#09111F]"
            onClick={() =>
              onConfirm({ signature_type: 'typed', signature_data: typedName.trim() })
            }
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm signature
          </Button>
        </TabsContent>

        <TabsContent value="drawn" className="mt-4 space-y-3">
          <canvas
            ref={canvasRef}
            width={480}
            height={160}
            className="w-full rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] touch-none"
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearCanvas}>
              Clear
            </Button>
            <Button
              disabled={loading}
              className="bg-[var(--ozer-accent)] text-[#09111F]"
              onClick={() => {
                const data = getDrawnDataUrl();
                if (data) onConfirm({ signature_type: 'drawn', signature_data: data });
              }}
            >
              Confirm signature
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">JPG, PNG, GIF, or BMP</p>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/bmp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </TabsContent>
      </Tabs>

      {onCancel ? (
        <Button variant="ghost" className="mt-3" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

export function SignatureDisplay({
  type,
  data,
  name,
  signedAt,
}: {
  type?: string | null;
  data?: string | null;
  name?: string | null;
  signedAt?: string | null;
}) {
  if (!data) {
    return (
      <div className="rounded border border-dashed border-[color:var(--ozer-border-on-light)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Not signed yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {type === 'typed' ? (
        <p className="font-serif text-2xl text-[#0f172a]" style={{ fontFamily: 'Georgia, serif' }}>
          {data}
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data} alt="Signature" className="max-h-20 object-contain" />
      )}
      <div className="border-t border-[color:var(--workspace-shell-border)] pt-1">
        <p className="text-sm font-medium">{name ?? '—'}</p>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {signedAt
            ? `Signed ${new Date(signedAt).toLocaleDateString('en-GB')}`
            : 'Date: (not signed yet)'}
        </p>
      </div>
    </div>
  );
}
