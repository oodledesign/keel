/**
 * Local-area lookup for brochures from bundled UK datasets — no network calls.
 *
 * - Stations: DfT NaPTAN rail/metro stop areas → `data/uk-stations.json`.
 * - Motorway junctions: OSM `highway=motorway_junction` nodes on `M*` roads,
 *   one row per junction → `data/uk-motorway-junctions.json`.
 * - Cities/towns/villages/suburbs: OSM `place=*` nodes → `data/uk-places.json`.
 * - Airports: static list of UK passenger airports below.
 *
 * OSM data is © OpenStreetMap contributors (ODbL); NaPTAN is OGL.
 */
import 'server-only';

import {
  type LocalAreaFacts,
  type LocalAreaPlace,
  type LocalAreaPlaceKind,
  bearingDegrees,
  haversineKm,
} from '~/lib/commercial/brochure-pdf/local-area.shared';

type LatLng = { latitude: number; longitude: number };

/** [name, lat, lng] — name already reads "Otford station". */
type StationRow = [string, number, number];
/** [motorway, junction ref, lat, lng] */
type JunctionRow = [string, string, number, number];
/** [name, lat, lng, kind] — c city, t town, v village, s suburb. */
type PlaceRow = [string, number, number, 'c' | 't' | 'v' | 's'];

type Datasets = {
  stations: StationRow[];
  junctions: JunctionRow[];
  places: PlaceRow[];
};

let datasets: Promise<Datasets> | null = null;

/** ~1 MB of JSON: parsed on first lookup, not when the module is imported. */
function loadDatasets(): Promise<Datasets> {
  datasets ??= Promise.all([
    import('./data/uk-stations.json'),
    import('./data/uk-motorway-junctions.json'),
    import('./data/uk-places.json'),
  ])
    .then(([stations, junctions, places]) => ({
      stations: stations.default as unknown as StationRow[],
      junctions: junctions.default as unknown as JunctionRow[],
      places: places.default as unknown as PlaceRow[],
    }))
    .catch((error: unknown) => {
      datasets = null;
      throw error;
    });
  return datasets;
}

const STATION_MAX_KM = 8;
const SECOND_STATION_MAX_KM = 4;
const MOTORWAY_MAX_KM = 20;
const TOWN_MAX_KM = 30;
const LOCALITY_MAX_KM = 1.5;
const AIRPORT_MAX_KM = 90;

/** UK passenger airports worth naming on a brochure (terminal coordinates). */
const MAJOR_UK_AIRPORTS: ReadonlyArray<{ name: string } & LatLng> = [
  { name: 'Heathrow Airport', latitude: 51.47, longitude: -0.4543 },
  { name: 'Gatwick Airport', latitude: 51.1537, longitude: -0.1821 },
  { name: 'Stansted Airport', latitude: 51.885, longitude: 0.235 },
  { name: 'Luton Airport', latitude: 51.8747, longitude: -0.3683 },
  { name: 'London City Airport', latitude: 51.5048, longitude: 0.0495 },
  { name: 'Southend Airport', latitude: 51.5714, longitude: 0.6956 },
  { name: 'Birmingham Airport', latitude: 52.4539, longitude: -1.748 },
  { name: 'Manchester Airport', latitude: 53.365, longitude: -2.2728 },
  { name: 'Bristol Airport', latitude: 51.3827, longitude: -2.7191 },
  { name: 'Edinburgh Airport', latitude: 55.95, longitude: -3.3725 },
  { name: 'Glasgow Airport', latitude: 55.8719, longitude: -4.4331 },
  { name: 'Leeds Bradford Airport', latitude: 53.8659, longitude: -1.6606 },
  { name: 'Newcastle Airport', latitude: 55.0375, longitude: -1.6917 },
  { name: 'East Midlands Airport', latitude: 52.8311, longitude: -1.3281 },
  {
    name: 'Liverpool John Lennon Airport',
    latitude: 53.3336,
    longitude: -2.8497,
  },
  {
    name: 'Belfast International Airport',
    latitude: 54.6575,
    longitude: -6.2158,
  },
  {
    name: 'George Best Belfast City Airport',
    latitude: 54.6181,
    longitude: -5.8725,
  },
  { name: 'Aberdeen Airport', latitude: 57.2019, longitude: -2.1978 },
  { name: 'Southampton Airport', latitude: 50.9503, longitude: -1.3568 },
  { name: 'Exeter Airport', latitude: 50.7344, longitude: -3.4139 },
  { name: 'Cardiff Airport', latitude: 51.3967, longitude: -3.3433 },
  { name: 'Norwich Airport', latitude: 52.6758, longitude: 1.2828 },
  { name: 'Bournemouth Airport', latitude: 50.78, longitude: -1.8425 },
  { name: 'Inverness Airport', latitude: 57.5425, longitude: -4.0475 },
  { name: 'Teesside Airport', latitude: 54.5092, longitude: -1.4294 },
  { name: 'Newquay Airport', latitude: 50.4406, longitude: -4.9954 },
  { name: 'Glasgow Prestwick Airport', latitude: 55.5094, longitude: -4.5867 },
  { name: 'Humberside Airport', latitude: 53.5744, longitude: -0.3508 },
];

/** Cheap bounding-box reject before haversine (1° lat ≈ 111 km). */
function roughlyWithin(origin: LatLng, lat: number, lng: number, km: number) {
  const dLat = Math.abs(lat - origin.latitude) * 111;
  if (dLat > km) return false;
  const dLng =
    Math.abs(lng - origin.longitude) *
    111 *
    Math.cos((origin.latitude * Math.PI) / 180);
  return dLng <= km;
}

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function makePlace(
  origin: LatLng,
  kind: LocalAreaPlaceKind,
  name: string,
  at: LatLng,
  extra?: Partial<LocalAreaPlace>,
): LocalAreaPlace {
  return {
    kind,
    name,
    km: haversineKm(origin, at),
    latitude: at.latitude,
    longitude: at.longitude,
    bearing: bearingDegrees(origin, at),
    ...extra,
  };
}

function nearestStations(
  origin: LatLng,
  stations: StationRow[],
): LocalAreaPlace[] {
  const hits: LocalAreaPlace[] = [];
  for (const [name, lat, lng] of stations) {
    if (!roughlyWithin(origin, lat, lng, STATION_MAX_KM)) continue;
    const place = makePlace(origin, 'station', name, {
      latitude: lat,
      longitude: lng,
    });
    if (place.km <= STATION_MAX_KM) hits.push(place);
  }
  hits.sort((a, b) => a.km - b.km);
  const [first, second] = hits;
  if (!first) return [];
  return second && second.km <= SECOND_STATION_MAX_KM
    ? [first, second]
    : [first];
}

function nearestMotorwayJunctions(
  origin: LatLng,
  junctions: JunctionRow[],
): LocalAreaPlace[] {
  const byMotorway = new Map<string, LocalAreaPlace>();
  for (const [motorway, ref, lat, lng] of junctions) {
    if (!roughlyWithin(origin, lat, lng, MOTORWAY_MAX_KM)) continue;
    const place = makePlace(origin, 'motorway', `${motorway} Junction ${ref}`, {
      latitude: lat,
      longitude: lng,
    });
    if (place.km > MOTORWAY_MAX_KM) continue;
    const existing = byMotorway.get(motorway);
    if (!existing || place.km < existing.km) byMotorway.set(motorway, place);
  }
  return [...byMotorway.values()].sort((a, b) => a.km - b.km).slice(0, 2);
}

function townAndLocality(
  origin: LatLng,
  town: string | null | undefined,
  places: PlaceRow[],
): { town: LocalAreaPlace | null; locality: string | null } {
  const wanted = town?.trim() ? normaliseName(town) : null;
  let namedTown: LocalAreaPlace | null = null;
  let nearestTown: LocalAreaPlace | null = null;
  let nearestPlace: { name: string; km: number } | null = null;

  for (const [name, lat, lng, kind] of places) {
    if (!roughlyWithin(origin, lat, lng, TOWN_MAX_KM)) continue;
    const at = { latitude: lat, longitude: lng };
    const km = haversineKm(origin, at);

    if (km <= LOCALITY_MAX_KM && (!nearestPlace || km < nearestPlace.km)) {
      nearestPlace = { name, km };
    }

    if (kind !== 'c' && kind !== 't') continue;
    if (km > TOWN_MAX_KM) continue;
    const isCity = kind === 'c';
    if (wanted && normaliseName(name) === wanted) {
      if (!namedTown || km < namedTown.km) {
        namedTown = makePlace(origin, 'town', name, at, { isCity });
      }
    }
    if (!nearestTown || km < nearestTown.km) {
      nearestTown = makePlace(origin, 'town', name, at, { isCity });
    }
  }

  const resolvedTown = namedTown ?? nearestTown;
  const locality =
    nearestPlace &&
    (!resolvedTown ||
      normaliseName(nearestPlace.name) !== normaliseName(resolvedTown.name))
      ? nearestPlace.name
      : null;

  return { town: resolvedTown, locality };
}

function nearestAirport(origin: LatLng): LocalAreaPlace | null {
  let best: LocalAreaPlace | null = null;
  for (const airport of MAJOR_UK_AIRPORTS) {
    const place = makePlace(origin, 'airport', airport.name, airport);
    if (place.km <= AIRPORT_MAX_KM && (!best || place.km < best.km)) {
      best = place;
    }
  }
  return best;
}

/**
 * Stations, motorway junctions, town centre, locality and nearest major
 * airport for a UK point. Returns null for invalid coordinates or when the
 * point is outside the datasets' coverage (no town within range).
 */
export async function lookupLocalAreaFacts(input: {
  latitude: number;
  longitude: number;
  town?: string | null;
}): Promise<LocalAreaFacts | null> {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return null;
  }
  const origin = { latitude: input.latitude, longitude: input.longitude };
  const data = await loadDatasets();

  const { town, locality } = townAndLocality(origin, input.town, data.places);
  const stations = nearestStations(origin, data.stations);
  const motorways = nearestMotorwayJunctions(origin, data.junctions);
  const airport = nearestAirport(origin);

  const places: LocalAreaPlace[] = [
    ...stations,
    ...motorways,
    ...(town ? [town] : []),
    ...(airport ? [airport] : []),
  ];
  if (!town && stations.length === 0 && motorways.length === 0) return null;

  return { locality, places };
}
