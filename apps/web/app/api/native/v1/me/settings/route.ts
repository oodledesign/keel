import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, readJsonBody } from '~/lib/native/http';
import {
  loadNativePersonalSettings,
  updateNativePersonalSettings,
} from '~/lib/native/personal-settings';
import { parseNativePersonalSettingsPatch } from '~/lib/native/settings-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    return NextResponse.json(await loadNativePersonalSettings(auth.context));
  } catch (error) {
    return handleNativeError(error, 'me/settings');
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const patch = parseNativePersonalSettingsPatch(await readJsonBody(request));
    return NextResponse.json(
      await updateNativePersonalSettings(auth.context, patch),
    );
  } catch (error) {
    return handleNativeError(error, 'me/settings');
  }
}
