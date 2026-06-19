import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

const RECIPE_GENERATE_SYSTEM_PROMPT = `You are a family recipe assistant inside Ozer. Suggest complete, cookable recipes inspired by popular home cooking — weeknight staples, trending one-pan meals, comfort food people share on Instagram and food blogs, and classic family favourites.

You will receive JSON with:
- "count": how many recipes to return (match exactly)
- "meal_type": primary meal slot (breakfast, lunch, dinner, snack, or any)
- "dietary_requirements": hard constraints — never violate
- "priorities": soft preferences (healthy, quick, cheap, kid-friendly, etc.)
- "disliked_ingredients": avoid where reasonable
- "household_size": default servings unless a recipe naturally serves fewer
- "preference_notes": free-text from saved meal preferences
- "favorite_recipes": names of recipes the user already loves — suggest similar vibes, cuisines, or techniques
- "favorite_dishes": free-text dishes the user typed before generating (e.g. "pad thai, roast chicken")
- "inspiration": what to lean into (e.g. "viral IG pasta", "air fryer", "Mediterranean")
- "use_saved_favorites": whether to echo saved favourite recipes
- "existing_recipe_names": names already in their library — do NOT duplicate or near-duplicate

Rules:
- Respect every dietary requirement strictly.
- Each recipe must feel distinct (different cuisine, protein, or cooking method).
- Draw on well-known public recipes and food-culture trends — describe originals in your own words; do not copy branded restaurant names.
- Include practical ingredients available in UK supermarkets unless notes say otherwise.
- Keep names appetising (max ~8 words).
- Provide realistic prep/cook minutes and ingredient lists with quantities.
- Add a short "inspiration" line citing the vibe (e.g. "Trending one-pan lemon chicken bowls").

Respond with ONLY valid minified JSON:
{"recipes":[{"name":"string","description":"string","ingredients":["200g pasta","2 tbsp olive oil"],"instructions":"string","tags":["quick","italian"],"meal_type":"dinner","prep_minutes":10,"cook_minutes":25,"servings":4,"inspiration":"string"}]}
Return exactly "count" recipes.`;

export type GeneratedRecipeDraft = {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string;
  tags: string[];
  meal_type: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  inspiration: string;
};

export type MealRecipesGeneratePayload = {
  count: number;
  meal_type: string;
  dietary_requirements: string[];
  priorities: string[];
  disliked_ingredients: string[];
  household_size: number;
  preference_notes: string;
  favorite_recipes: string[];
  favorite_dishes: string[];
  inspiration: string;
  use_saved_favorites: boolean;
  existing_recipe_names: string[];
};

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function parseOptionalInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  return null;
}

export async function generateMealRecipes(
  payload: MealRecipesGeneratePayload,
): Promise<GeneratedRecipeDraft[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = resolveAnthropicModel();

  const maxTokens = payload.count > 5 ? 8_192 : 4_096;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: RECIPE_GENERATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Anthropic API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text =
    body.content?.find((part) => part.type === 'text')?.text?.trim() ?? '';
  if (!text) {
    throw new Error('Empty response from recipe generator');
  }

  let parsed: { recipes?: unknown };
  try {
    parsed = JSON.parse(extractJson(text)) as { recipes?: unknown };
  } catch {
    throw new Error('Could not parse recipe generator response');
  }

  const existing = new Set(
    payload.existing_recipe_names.map((name) => name.trim().toLowerCase()),
  );
  const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];

  const normalized = recipes
    .map((recipe): GeneratedRecipeDraft | null => {
      if (!recipe || typeof recipe !== 'object') return null;
      const r = recipe as Record<string, unknown>;
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      if (!name || existing.has(name.toLowerCase())) return null;

      return {
        name,
        description:
          typeof r.description === 'string' ? r.description.trim() : '',
        ingredients: Array.isArray(r.ingredients)
          ? r.ingredients
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 80)
          : [],
        instructions:
          typeof r.instructions === 'string' ? r.instructions.trim() : '',
        tags: Array.isArray(r.tags)
          ? r.tags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean)
              .slice(0, 20)
          : [],
        meal_type:
          typeof r.meal_type === 'string' && r.meal_type.trim()
            ? r.meal_type.trim()
            : payload.meal_type,
        prep_minutes: parseOptionalInt(r.prep_minutes),
        cook_minutes: parseOptionalInt(r.cook_minutes),
        servings:
          parseOptionalInt(r.servings) ??
          (payload.household_size > 0 ? payload.household_size : 4),
        inspiration:
          typeof r.inspiration === 'string' ? r.inspiration.trim() : '',
      };
    })
    .filter((recipe): recipe is GeneratedRecipeDraft => recipe !== null);

  if (normalized.length === 0) {
    throw new Error('The recipe generator did not return any usable recipes');
  }

  return normalized.slice(0, payload.count);
}
