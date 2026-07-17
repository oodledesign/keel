import { NextResponse } from 'next/server';

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export function jsonOk<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function jsonErr(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false as const, error: { code, message, details } },
    { status },
  );
}
