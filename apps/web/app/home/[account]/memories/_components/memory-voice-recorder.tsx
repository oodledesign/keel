'use client';

import { useEffect, useRef, useState } from 'react';

import { Mic, Square } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal?: boolean;
          0?: { transcript?: string };
        }>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/mpeg',
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function extensionForMime(mime: string) {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

export type MemoryVoiceTake = {
  transcript: string;
  audio: File | null;
};

type Props = {
  disabled?: boolean;
  keepRecording: boolean;
  onKeepRecordingChange: (keep: boolean) => void;
  onTake: (take: MemoryVoiceTake) => void;
};

export function MemoryVoiceRecorder({
  disabled,
  keepRecording,
  onKeepRecordingChange,
  onTake,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTextRef = useRef('');
  const mimeRef = useRef('');
  const keepRef = useRef(keepRecording);

  useEffect(() => {
    keepRef.current = keepRecording;
  }, [keepRecording]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    setError(null);
    finalTextRef.current = '';
    setLiveText('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickRecorderMime();
      mimeRef.current = mime;
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();

      const Ctor = speechRecognitionCtor();
      if (Ctor) {
        const recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-GB';
        recognition.onresult = (event) => {
          let finalText = finalTextRef.current;
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const piece = event.results[i]?.[0]?.transcript?.trim() ?? '';
            if (!piece) continue;
            if (event.results[i]?.isFinal) {
              finalText = [finalText, piece].filter(Boolean).join(' ');
            } else {
              interim = [interim, piece].filter(Boolean).join(' ');
            }
          }
          finalTextRef.current = finalText;
          setLiveText([finalText, interim].filter(Boolean).join(' '));
        };
        recognition.onerror = (event) => {
          if (event.error && event.error !== 'no-speech') {
            setError(event.error);
          }
        };
        recognition.onend = () => {
          if (recorderRef.current?.state === 'recording') {
            try {
              recognition.start();
            } catch {
              // Recognition ended because we stopped.
            }
          }
        };
        recognitionRef.current = recognition;
        recognition.start();
      }

      setIsRecording(true);
    } catch {
      setError('Microphone access is needed to record a memory.');
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recorderRef.current = null;
    recognition?.stop();

    const finish = (audio: File | null) => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      const transcript = (finalTextRef.current || liveText).trim();
      setLiveText('');
      onTake({
        transcript,
        audio: keepRef.current ? audio : null,
      });
    };

    if (!recorder || recorder.state === 'inactive') {
      finish(null);
      return;
    }

    recorder.onstop = () => {
      const mime = mimeRef.current || recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      const audio =
        blob.size > 0
          ? new File([blob], `memory-voice.${extensionForMime(mime)}`, {
              type: mime,
            })
          : null;
      finish(audio);
    };
    recorder.stop();
  }

  const captionsSupported = Boolean(speechRecognitionCtor());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Dictate</p>
        <div className="flex items-center gap-2">
          <Switch
            id="keep-memory-recording"
            checked={keepRecording}
            onCheckedChange={onKeepRecordingChange}
            disabled={disabled || isRecording}
          />
          <Label
            htmlFor="keep-memory-recording"
            className="text-xs font-normal"
          >
            Keep recording
          </Label>
        </div>
      </div>
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Same idea as survey running notes: speak, then edit the text. Surveys
        always keep the audio; memories do the same unless you turn that off.
      </p>
      {liveText ? (
        <p className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm">
          {liveText}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-[var(--ozer-accent)]">{error}</p>
      ) : null}
      {!captionsSupported ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Live captions are not available in this browser. You can still keep
          the recording as a voice note.
        </p>
      ) : null}
      <Button
        type="button"
        variant={isRecording ? 'outline' : 'default'}
        className={isRecording ? undefined : workspaceBtnPrimaryMd}
        onClick={() => (isRecording ? stop() : void start())}
        disabled={disabled}
        data-test="memory-record"
      >
        {isRecording ? (
          <>
            <Square className="h-4 w-4" />
            Stop
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            Record
          </>
        )}
      </Button>
    </div>
  );
}
