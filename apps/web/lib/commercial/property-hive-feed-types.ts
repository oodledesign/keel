/**
 * Property Hive Kato XML matches each `<types><type>` string to an existing
 * `commercial_property_type` term by name. Unknown names are skipped — the
 * property still imports, but with no type — so a type filter (Bracketts
 * Industrial is term 45, name "Industrial") excludes it.
 *
 * Ozer stores "Industrial / Warehouse". That string is not a Property Hive
 * default term ("Industrial") and not Bracketts' term. Emit the stored label
 * plus the name PH already has, so either taxonomy matches.
 */

const PROPERTY_HIVE_TYPE_ALIASES: Readonly<Record<string, readonly string[]>> =
  {
    // PH default + Bracketts search label. The slash form matches neither.
    'industrial / warehouse': ['Industrial'],
    'industrial/warehouse': ['Industrial'],
    'industrial/logistics': ['Industrial'],
    'industrial / logistics': ['Industrial'],
    // PH's default term is singular "Office". Bracketts renamed theirs to
    // "Offices", which already equals the Ozer label, so "Office" is only an
    // extra candidate for installs that kept the default.
    offices: ['Office'],
    'serviced office': ['Offices', 'Office'],
    'serviced offices': ['Offices', 'Office'],
  };

function normalizeSectorKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Type names to write under `<types>`. Empty when the listing has no sector.
 * The stored sector is always included so a custom term with that exact name
 * still matches. Aliases are names Property Hive already ships or that
 * Bracketts' search form uses.
 */
export function mapCommercialSectorToPropertyHiveTypes(
  sector: string | null | undefined,
): string[] {
  const value = sector?.trim().replace(/\s+/g, ' ') ?? '';
  if (!value) return [];

  const extras = PROPERTY_HIVE_TYPE_ALIASES[normalizeSectorKey(value)] ?? [];
  const seen = new Set<string>();
  const types: string[] = [];

  for (const name of [value, ...extras]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    types.push(name);
  }

  return types;
}
