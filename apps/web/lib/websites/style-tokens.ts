/**
 * Site Studio style tokens (Prompt D1).
 * Stored in website_style_systems.tokens jsonb (schemaVersion inside).
 */

export const WEBSITE_STYLE_TOKENS_SCHEMA_VERSION = '1.0' as const;

export type WebsiteStyleSpacingDensity =
  | 'compact'
  | 'comfortable'
  | 'spacious';

export type WebsiteStyleButtonStyle = 'pill' | 'rounded' | 'square';

export type WebsiteStyleColors = {
  primary: string;
  secondary: string;
  accent: string;
  /** 5–7 neutral steps from lightest (index 0) to darkest. */
  neutrals: string[];
  success: string;
  warning: string;
  danger: string;
};

export type WebsiteStyleTypography = {
  displayFamily: string;
  bodyFamily: string;
  typeScale: {
    /** Root body size in px. */
    base: number;
    /** Modular scale ratio (e.g. 1.25). */
    ratio: number;
  };
  weights: {
    regular: number;
    medium: number;
    bold: number;
  };
};

/** Radius scale — CSS lengths for none → full. */
export type WebsiteStyleRadiusScale = {
  none: string;
  sm: string;
  md: string;
  lg: string;
  full: string;
};

export type WebsiteStyleTokens = {
  schemaVersion: typeof WEBSITE_STYLE_TOKENS_SCHEMA_VERSION;
  colors: WebsiteStyleColors;
  typography: WebsiteStyleTypography;
  radius: WebsiteStyleRadiusScale;
  spacingDensity: WebsiteStyleSpacingDensity;
  photographyDirection: string;
  buttons: {
    style: WebsiteStyleButtonStyle;
  };
};

export type WebsiteMoodboardRef = {
  url: string;
  note: string;
  /** Optional image / asset refs for later capture. */
  imageRefs?: string[];
  /** Hex colours pulled from the reference when available. */
  extractedPalette?: string[];
};

export type WebsiteStyleSystem = {
  tokens: WebsiteStyleTokens;
  moodboard: WebsiteMoodboardRef[];
  /** User locked tokens — AI suggest must not overwrite. */
  locked: boolean;
};

export function emptyWebsiteStyleTokens(): WebsiteStyleTokens {
  return {
    schemaVersion: WEBSITE_STYLE_TOKENS_SCHEMA_VERSION,
    colors: {
      primary: '#2F5D50',
      secondary: '#6B8F71',
      accent: '#FF5C34',
      neutrals: [
        '#FAFAF8',
        '#F3F2EF',
        '#E8E6E1',
        '#C9C5BD',
        '#6B6862',
        '#3F3D3A',
        '#1C1B1A',
      ],
      success: '#2F7D4A',
      warning: '#C9852A',
      danger: '#B42318',
    },
    typography: {
      displayFamily: 'Cabinet Grotesk',
      bodyFamily: 'General Sans',
      typeScale: { base: 16, ratio: 1.25 },
      weights: { regular: 400, medium: 500, bold: 700 },
    },
    radius: {
      none: '0px',
      sm: '0.375rem',
      md: '0.75rem',
      lg: '1.25rem',
      full: '9999px',
    },
    spacingDensity: 'comfortable',
    photographyDirection: '',
    buttons: { style: 'rounded' },
  };
}

export function emptyWebsiteStyleSystem(): WebsiteStyleSystem {
  return {
    tokens: emptyWebsiteStyleTokens(),
    moodboard: [],
    locked: false,
  };
}

type LegacyStyleTokens = {
  canvas?: string;
  atmosphere?: string;
  accent?: string;
  contrast?: string;
  secondary?: string;
  headingFont?: string;
  bodyFont?: string;
  typeScale?: 'compact' | 'regular' | 'display' | WebsiteStyleTypography['typeScale'];
  radius?: 'sharp' | 'soft' | 'round' | WebsiteStyleRadiusScale;
  spacingDensity?: 'tight' | 'regular' | 'airy' | WebsiteStyleSpacingDensity;
  photographyDirection?: string;
  buttons?: { style?: WebsiteStyleButtonStyle };
  colors?: Partial<WebsiteStyleColors>;
  typography?: Partial<WebsiteStyleTypography>;
  schemaVersion?: string;
};

function radiusFromLegacy(
  value: LegacyStyleTokens['radius'],
): WebsiteStyleRadiusScale {
  if (value && typeof value === 'object' && 'md' in value) {
    return {
      none: value.none ?? '0px',
      sm: value.sm ?? '0.375rem',
      md: value.md ?? '0.75rem',
      lg: value.lg ?? '1.25rem',
      full: value.full ?? '9999px',
    };
  }
  switch (value) {
    case 'sharp':
      return {
        none: '0px',
        sm: '0px',
        md: '0.125rem',
        lg: '0.25rem',
        full: '9999px',
      };
    case 'round':
      return {
        none: '0px',
        sm: '0.75rem',
        md: '1.25rem',
        lg: '2rem',
        full: '9999px',
      };
    default:
      return emptyWebsiteStyleTokens().radius;
  }
}

function spacingFromLegacy(
  value: LegacyStyleTokens['spacingDensity'],
): WebsiteStyleSpacingDensity {
  if (value === 'compact' || value === 'comfortable' || value === 'spacious') {
    return value;
  }
  if (value === 'tight') return 'compact';
  if (value === 'airy') return 'spacious';
  return 'comfortable';
}

function typeScaleFromLegacy(
  value: LegacyStyleTokens['typeScale'],
): WebsiteStyleTypography['typeScale'] {
  if (value && typeof value === 'object' && 'base' in value) {
    return {
      base: Number(value.base) || 16,
      ratio: Number(value.ratio) || 1.25,
    };
  }
  switch (value) {
    case 'compact':
      return { base: 15, ratio: 1.2 };
    case 'display':
      return { base: 17, ratio: 1.333 };
    default:
      return { base: 16, ratio: 1.25 };
  }
}

/**
 * Migrate legacy 4-role tokens (or partial D1) into the D1 StyleTokens shape.
 */
export function normalizeWebsiteStyleTokens(
  input: unknown,
): WebsiteStyleTokens {
  const empty = emptyWebsiteStyleTokens();
  if (!input || typeof input !== 'object') return empty;

  const raw = input as LegacyStyleTokens;

  if (raw.colors && typeof raw.colors === 'object') {
    const neutrals = Array.isArray(raw.colors.neutrals)
      ? raw.colors.neutrals.filter((item) => typeof item === 'string').slice(0, 7)
      : empty.colors.neutrals;
    while (neutrals.length < 5) {
      neutrals.push(empty.colors.neutrals[neutrals.length] ?? '#888888');
    }

    return {
      schemaVersion: WEBSITE_STYLE_TOKENS_SCHEMA_VERSION,
      colors: {
        primary: String(raw.colors.primary ?? empty.colors.primary),
        secondary: String(raw.colors.secondary ?? empty.colors.secondary),
        accent: String(raw.colors.accent ?? empty.colors.accent),
        neutrals,
        success: String(raw.colors.success ?? empty.colors.success),
        warning: String(raw.colors.warning ?? empty.colors.warning),
        danger: String(raw.colors.danger ?? empty.colors.danger),
      },
      typography: {
        displayFamily: String(
          raw.typography?.displayFamily ??
            raw.headingFont ??
            empty.typography.displayFamily,
        ),
        bodyFamily: String(
          raw.typography?.bodyFamily ??
            raw.bodyFont ??
            empty.typography.bodyFamily,
        ),
        typeScale: typeScaleFromLegacy(
          raw.typography?.typeScale ?? raw.typeScale,
        ),
        weights: {
          regular: Number(raw.typography?.weights?.regular) || 400,
          medium: Number(raw.typography?.weights?.medium) || 500,
          bold: Number(raw.typography?.weights?.bold) || 700,
        },
      },
      radius: radiusFromLegacy(raw.radius),
      spacingDensity: spacingFromLegacy(raw.spacingDensity),
      photographyDirection: String(
        raw.photographyDirection ?? empty.photographyDirection,
      ),
      buttons: {
        style:
          raw.buttons?.style === 'pill' ||
          raw.buttons?.style === 'square' ||
          raw.buttons?.style === 'rounded'
            ? raw.buttons.style
            : 'rounded',
      },
    };
  }

  // Legacy flat canvas/atmosphere/accent/contrast shape.
  const neutrals = [
    String(raw.canvas ?? empty.colors.neutrals[0]),
    String(raw.atmosphere ?? empty.colors.neutrals[1]),
    empty.colors.neutrals[2]!,
    empty.colors.neutrals[3]!,
    empty.colors.neutrals[4]!,
    empty.colors.neutrals[5]!,
    String(raw.contrast ?? empty.colors.neutrals[6]),
  ];

  return {
    schemaVersion: WEBSITE_STYLE_TOKENS_SCHEMA_VERSION,
    colors: {
      primary: String(raw.accent ?? empty.colors.primary),
      secondary: String(raw.secondary ?? empty.colors.secondary),
      accent: String(raw.accent ?? empty.colors.accent),
      neutrals,
      success: empty.colors.success,
      warning: empty.colors.warning,
      danger: empty.colors.danger,
    },
    typography: {
      displayFamily: String(raw.headingFont || empty.typography.displayFamily),
      bodyFamily: String(raw.bodyFont || empty.typography.bodyFamily),
      typeScale: typeScaleFromLegacy(raw.typeScale),
      weights: empty.typography.weights,
    },
    radius: radiusFromLegacy(raw.radius),
    spacingDensity: spacingFromLegacy(raw.spacingDensity),
    photographyDirection: String(raw.photographyDirection ?? ''),
    buttons: { style: 'rounded' },
  };
}

export function normalizeWebsiteStyleSystem(input: unknown): WebsiteStyleSystem {
  const empty = emptyWebsiteStyleSystem();
  if (!input || typeof input !== 'object') return empty;

  const raw = input as {
    tokens?: unknown;
    moodboard?: unknown;
    locked?: unknown;
  };

  const moodboard = Array.isArray(raw.moodboard)
    ? raw.moodboard
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const row = item as WebsiteMoodboardRef;
          return {
            url: String(row.url ?? ''),
            note: String(row.note ?? ''),
            imageRefs: Array.isArray(row.imageRefs)
              ? row.imageRefs.map(String)
              : undefined,
            extractedPalette: Array.isArray(row.extractedPalette)
              ? row.extractedPalette.map(String)
              : undefined,
          };
        })
    : [];

  return {
    tokens: normalizeWebsiteStyleTokens(raw.tokens),
    moodboard,
    locked: Boolean(raw.locked),
  };
}

/** Prefer dedicated columns; fall back to legacy composite `style` jsonb. */
export function styleSystemFromDbRow(
  row:
    | {
        style?: unknown;
        tokens?: unknown;
        moodboard?: unknown;
        locked?: unknown;
      }
    | null
    | undefined,
): WebsiteStyleSystem {
  if (!row) return emptyWebsiteStyleSystem();

  const tokensObj =
    row.tokens && typeof row.tokens === 'object'
      ? (row.tokens as Record<string, unknown>)
      : null;
  const hasDedicatedTokens = Boolean(
    tokensObj && Object.keys(tokensObj).length > 0,
  );

  if (hasDedicatedTokens) {
    const legacy =
      row.style && typeof row.style === 'object'
        ? (row.style as { moodboard?: unknown; locked?: unknown })
        : {};
    return normalizeWebsiteStyleSystem({
      tokens: row.tokens,
      moodboard: row.moodboard ?? legacy.moodboard,
      locked: row.locked ?? legacy.locked,
    });
  }

  return normalizeWebsiteStyleSystem(row.style);
}

/** Seeded brand A — warm coral agency. */
export function seedStyleTokensBrandA(): WebsiteStyleTokens {
  return {
    ...emptyWebsiteStyleTokens(),
    colors: {
      primary: '#FF5C34',
      secondary: '#351E28',
      accent: '#FF7A5C',
      neutrals: [
        '#FBF6EC',
        '#F4EFE3',
        '#E8DFD0',
        '#C9B8A4',
        '#8A7360',
        '#4A3428',
        '#2A1720',
      ],
      success: '#3D7A4A',
      warning: '#D4A017',
      danger: '#C0392B',
    },
    typography: {
      displayFamily: 'Cabinet Grotesk',
      bodyFamily: 'General Sans',
      typeScale: { base: 16, ratio: 1.333 },
      weights: { regular: 400, medium: 500, bold: 700 },
    },
    spacingDensity: 'spacious',
    photographyDirection:
      'Warm natural light, real teams, cream atmospheres — no stocky handshakes.',
    buttons: { style: 'pill' },
  };
}

/** Seeded brand B — cool editorial teal. */
export function seedStyleTokensBrandB(): WebsiteStyleTokens {
  return {
    ...emptyWebsiteStyleTokens(),
    colors: {
      primary: '#0F4C5C',
      secondary: '#5C80BC',
      accent: '#E36414',
      neutrals: [
        '#F7F9FB',
        '#EEF2F6',
        '#D9E2EC',
        '#9FB3C8',
        '#627D98',
        '#334E68',
        '#102A43',
      ],
      success: '#2D6A4F',
      warning: '#BC6C25',
      danger: '#9B2226',
    },
    typography: {
      displayFamily: 'Fraunces',
      bodyFamily: 'Source Sans 3',
      typeScale: { base: 15, ratio: 1.2 },
      weights: { regular: 400, medium: 600, bold: 700 },
    },
    radius: {
      none: '0px',
      sm: '0.125rem',
      md: '0.25rem',
      lg: '0.5rem',
      full: '9999px',
    },
    spacingDensity: 'compact',
    photographyDirection:
      'Cool daylight, architectural crops, desaturated blues — documentary feel.',
    buttons: { style: 'square' },
  };
}
