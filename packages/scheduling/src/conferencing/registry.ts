import { TeamsConferencingProvider } from './teams/provider';
import type { ConferencingProvider, ConferencingProviderId } from './types';
import { ZoomConferencingProvider } from './zoom/provider';

const providers: Record<ConferencingProviderId, ConferencingProvider> = {
  zoom: new ZoomConferencingProvider(),
  teams: new TeamsConferencingProvider(),
};

export function getConferencingProvider(
  id: ConferencingProviderId,
): ConferencingProvider {
  return providers[id];
}

export function locationTypeToConferencingProvider(
  locationType: string,
): ConferencingProviderId | null {
  if (locationType === 'zoom' || locationType === 'teams') {
    return locationType;
  }
  return null;
}
