import { NextResponse } from 'next/server';

export class NativeHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'NativeHttpError';
    this.status = status;
  }
}

export function nativeJsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function nativeBadRequest(message = 'Invalid request') {
  return nativeJsonError(400, message);
}

export function nativeForbidden(message = 'Forbidden') {
  return nativeJsonError(403, message);
}

export function nativeNotFound(message = 'Not found') {
  return nativeJsonError(404, message);
}

export function nativeServerError(message = 'Internal server error') {
  return nativeJsonError(500, message);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new NativeHttpError(400, 'Invalid JSON body');
  }
}

export function handleNativeError(error: unknown, context: string) {
  if (error instanceof NativeHttpError) {
    return nativeJsonError(error.status, error.message);
  }

  console.error(`[native/v1/${context}]`, error);
  return nativeServerError();
}
