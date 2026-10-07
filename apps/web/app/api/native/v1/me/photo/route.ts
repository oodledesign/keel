import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readFormBlob,
} from '~/lib/native/http';
import {
  removeNativeProfilePhoto,
  uploadNativeProfilePhoto,
} from '~/lib/native/personal-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return nativeBadRequest('Invalid form data');
  }

  try {
    return NextResponse.json(
      await uploadNativeProfilePhoto(auth.context, readFormBlob(form)),
    );
  } catch (error) {
    return handleNativeError(error, 'me/photo');
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return NextResponse.json(await removeNativeProfilePhoto(auth.context));
  } catch (error) {
    return handleNativeError(error, 'me/photo');
  }
}
