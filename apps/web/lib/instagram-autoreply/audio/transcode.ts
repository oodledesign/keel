import 'server-only';

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  IG_AUDIO_MAX_DURATION_MS,
  parseFfmpegDurationMs,
} from './detect-format';

const FFMPEG_TIMEOUT_MS = 45_000;

export class IgTranscodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IgTranscodeError';
  }
}

async function resolveFfmpegPath(): Promise<string> {
  const mod = (await import('ffmpeg-static')) as unknown as {
    default?: string | null;
  };
  const resolved = mod.default ?? (mod as unknown as string | null);
  if (!resolved || typeof resolved !== 'string') {
    throw new IgTranscodeError('ffmpeg is not available on this server');
  }
  return resolved;
}

export type FfmpegRunner = (
  args: string[],
) => Promise<{ code: number | null; stderr: string }>;

export const runFfmpeg: FfmpegRunner = async (args) => {
  const bin = await resolveFfmpegPath();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new IgTranscodeError('Transcoding timed out'));
    }, FFMPEG_TIMEOUT_MS);

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 64_000) stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new IgTranscodeError(error.message));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
};

export type TranscodeResult = {
  output: Buffer;
  durationMs: number;
};

/**
 * Transcode any supported audio container into an Instagram-friendly voice note:
 * AAC in an .m4a (MP4) container, mono, 80 kbps, 44.1 kHz, faststart.
 */
export async function transcodeToM4a(
  input: Buffer,
  inputExtension: string,
  runner: FfmpegRunner = runFfmpeg,
): Promise<TranscodeResult> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ig-audio-'));
  const id = randomUUID();
  const inPath = path.join(dir, `${id}.${inputExtension}`);
  const outPath = path.join(dir, `${id}.m4a`);

  try {
    await writeFile(inPath, input);

    const capSeconds = Math.ceil(IG_AUDIO_MAX_DURATION_MS / 1000) + 2;
    const transcode = await runner([
      '-hide_banner',
      '-nostdin',
      '-y',
      '-i',
      inPath,
      '-t',
      String(capSeconds),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '44100',
      '-c:a',
      'aac',
      '-b:a',
      '80k',
      '-movflags',
      '+faststart',
      '-f',
      'ipod',
      outPath,
    ]);

    if (transcode.code !== 0) {
      throw new IgTranscodeError(
        'Could not convert this audio. Try recording again or upload an m4a/mp3 file.',
      );
    }

    const output = await readFile(outPath);
    if (output.length === 0) {
      throw new IgTranscodeError('Transcoded audio is empty');
    }

    // The source header (e.g. MediaRecorder webm) often has no duration, so
    // read it back from the encoded m4a.
    // Output is capped a little above the limit, so an over-long source still
    // reads back as too long and is rejected by the caller.
    const probe = await runner(['-hide_banner', '-nostdin', '-i', outPath]);
    const durationMs =
      parseFfmpegDurationMs(probe.stderr) ??
      parseFfmpegDurationMs(transcode.stderr);

    if (durationMs === null) {
      throw new IgTranscodeError('Could not read the audio duration');
    }

    return { output, durationMs };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
