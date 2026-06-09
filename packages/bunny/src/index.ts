import { createHash } from 'node:crypto';

const STREAM_API_BASE = 'https://video.bunnycdn.com';
const EMBED_BASE = 'https://iframe.mediadelivery.net/embed';

export type BunnyVideoStatus =
  | 'created'
  | 'uploaded'
  | 'processing'
  | 'transcoding'
  | 'finished'
  | 'error'
  | 'unknown';

export type BunnyVideo = {
  guid: string;
  title: string;
  status: BunnyVideoStatus;
  length: number;
  storageSize: number;
  thumbnailUrl: string | null;
  dateUploaded: string | null;
  width: number | null;
  height: number | null;
  availableResolutions: string | null;
  encodeProgress: number;
};

export type BunnyUploadSignature = {
  signature: string;
  expiry: number;
};

export type BunnyPlayerConfig = {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  responsive?: boolean;
  token?: string;
};

export type BunnyCaption = {
  srclang: string;
  label: string;
};

export type BunnyListVideosOptions = {
  page?: number;
  itemsPerPage?: number;
  search?: string;
  collection?: string;
  orderBy?: string;
};

type BunnyCreateVideoResponse = {
  guid: string;
  title?: string;
};

type BunnyListVideosResponse = {
  items?: BunnyVideoRaw[];
  totalItems?: number;
};

type BunnyVideoRaw = {
  guid?: string;
  title?: string;
  status?: number;
  length?: number;
  storageSize?: number;
  thumbnailUrl?: string;
  dateUploaded?: string;
  width?: number;
  height?: number;
  availableResolutions?: string;
  encodeProgress?: number;
};

const BUNNY_STATUS_MAP: Record<number, BunnyVideoStatus> = {
  0: 'created',
  1: 'uploaded',
  2: 'processing',
  3: 'transcoding',
  4: 'finished',
  5: 'error',
};

function mapBunnyVideo(raw: BunnyVideoRaw): BunnyVideo {
  const statusCode = raw.status ?? -1;

  return {
    guid: String(raw.guid ?? ''),
    title: String(raw.title ?? ''),
    status: BUNNY_STATUS_MAP[statusCode] ?? 'unknown',
    length: Number(raw.length ?? 0),
    storageSize: Number(raw.storageSize ?? 0),
    thumbnailUrl: raw.thumbnailUrl ?? null,
    dateUploaded: raw.dateUploaded ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    availableResolutions: raw.availableResolutions ?? null,
    encodeProgress: Number(raw.encodeProgress ?? 0),
  };
}

export class BunnyStreamClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error('Bunny Stream API key is required');
    }
  }

  async createVideo(
    libraryId: string,
    title: string,
  ): Promise<{ videoId: string; uploadUrl?: string }> {
    const response = await this.request<BunnyCreateVideoResponse>(
      `/library/${libraryId}/videos`,
      {
        method: 'POST',
        body: JSON.stringify({ title }),
      },
    );

    const videoId = response.guid;
    if (!videoId) {
      throw new Error('Bunny Stream did not return a video id');
    }

    return {
      videoId,
      uploadUrl: `${STREAM_API_BASE}/library/${libraryId}/videos/${videoId}`,
    };
  }

  getUploadSignature(
    libraryId: string,
    videoId: string,
    expiryTime: number,
  ): BunnyUploadSignature {
    const signature = createHash('sha256')
      .update(`${libraryId}${this.apiKey}${expiryTime}${videoId}`)
      .digest('hex');

    return { signature, expiry: expiryTime };
  }

  async getVideo(libraryId: string, videoId: string): Promise<BunnyVideo> {
    const raw = await this.request<BunnyVideoRaw>(
      `/library/${libraryId}/videos/${videoId}`,
    );
    return mapBunnyVideo(raw);
  }

  async deleteVideo(libraryId: string, videoId: string): Promise<void> {
    await this.request<void>(`/library/${libraryId}/videos/${videoId}`, {
      method: 'DELETE',
    });
  }

  async listVideos(
    libraryId: string,
    options: BunnyListVideosOptions = {},
  ): Promise<BunnyVideo[]> {
    const params = new URLSearchParams();

    if (options.page != null) params.set('page', String(options.page));
    if (options.itemsPerPage != null) {
      params.set('itemsPerPage', String(options.itemsPerPage));
    }
    if (options.search) params.set('search', options.search);
    if (options.collection) params.set('collection', options.collection);
    if (options.orderBy) params.set('orderBy', options.orderBy);

    const query = params.toString();
    const path = `/library/${libraryId}/videos${query ? `?${query}` : ''}`;
    const response = await this.request<BunnyListVideosResponse | BunnyVideoRaw[]>(
      path,
    );

    const items = Array.isArray(response)
      ? response
      : (response.items ?? []);

    return items.map(mapBunnyVideo);
  }

  getEmbedUrl(
    libraryId: string,
    videoId: string,
    configId?: string,
    config?: BunnyPlayerConfig,
  ): string {
    const url = new URL(`${EMBED_BASE}/${libraryId}/${videoId}`);

    if (configId) {
      url.searchParams.set('config', configId);
    }

    if (config?.autoplay) url.searchParams.set('autoplay', 'true');
    if (config?.muted) url.searchParams.set('muted', 'true');
    if (config?.loop) url.searchParams.set('loop', 'true');
    if (config?.preload) url.searchParams.set('preload', config.preload);
    if (config?.responsive === false) url.searchParams.set('responsive', 'false');
    if (config?.token) url.searchParams.set('token', config.token);

    return url.toString();
  }

  getThumbnailUrl(
    cdnHostname: string,
    videoId: string,
    time = 0,
  ): string {
    const host = cdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}/${videoId}/${time}.jpg`;
  }

  async listCaptions(
    libraryId: string,
    videoId: string,
  ): Promise<BunnyCaption[]> {
    try {
      const raw = await this.request<
        | Array<{ srclang?: string; language?: string; label?: string }>
        | { captions?: Array<{ srclang?: string; language?: string; label?: string }> }
      >(`/library/${libraryId}/videos/${videoId}/captions`);

      const items = Array.isArray(raw) ? raw : (raw.captions ?? []);

      return items
        .map((item) => ({
          srclang: String(item.srclang ?? item.language ?? ''),
          label: String(item.label ?? item.srclang ?? item.language ?? ''),
        }))
        .filter((item) => item.srclang);
    } catch {
      return [];
    }
  }

  async uploadCaption(
    libraryId: string,
    videoId: string,
    input: {
      srclang: string;
      label: string;
      file: Blob;
    },
  ): Promise<void> {
    const form = new FormData();
    form.append('file', input.file, `${input.srclang}.srt`);
    form.append('srclang', input.srclang);
    form.append('label', input.label);

    const response = await fetch(
      `${STREAM_API_BASE}/library/${libraryId}/videos/${videoId}/captions`,
      {
        method: 'POST',
        headers: {
          AccessKey: this.apiKey,
        },
        body: form,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Bunny Stream caption upload ${response.status}: ${body || response.statusText}`,
      );
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${STREAM_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        AccessKey: this.apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Bunny Stream API ${response.status}: ${body || response.statusText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export function createBunnyStreamClient(apiKey = process.env.BUNNY_STREAM_API_KEY) {
  if (!apiKey?.trim()) {
    throw new Error('BUNNY_STREAM_API_KEY is not configured');
  }

  return new BunnyStreamClient(apiKey);
}
