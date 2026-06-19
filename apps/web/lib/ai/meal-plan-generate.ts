import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

const MEAL_PLAN_SYSTEM_PROMPT = `You are a family meal-planning assistant inside Ozer, a personal operating system. Your job is to plan dinners for a household for specific dates.

You will receive a JSON payload with:
- "dates": the dates that need a meal (YYYY-MM-DD). Plan exactly one dinner for each.
- "dietary_requirements": hard constraints you must never violate (e.g. vegetarian, gluten-free, nut allergy).
- "priorities": soft preferences to optimise for, in rough order of importance (e.g. healthy, quick, cheap).
- "disliked_ingredients": ingredients to avoid where reasonable.
- "household_size": number of people to cook for.
- "recipe_library": existing saved recipes [{ "name", "tags", "meal_type" }]. Reuse these by exact name when they fit; otherwise invent suitable new meals.
- "existing_meals": dinners already on the plan [{ "date", "title" }]. Do not change these; avoid repeating the same protein or cuisine on nearby days.
- "notes": free-text guidance from the user — treat as high priority.

Rules:
- Respect every dietary_requirement strictly. Never include a disallowed ingredient.
- Honour the priorities: if "quick" is set, keep total time low; if "cheap", use budget-friendly staples; if "healthy", balance protein/veg.
- Add variety across the week — do not repeat the same protein or cuisine on consecutive days unless asked.
- When planning many dates (e.g. a full month), keep variety across the whole range — rotate proteins, cuisines, and cooking styles.
- When a library recipe fits well, set "recipe_match" to its exact name. Otherwise set it to null.
- Keep titles short and appetising (max ~6 words). Keep descriptions to one sentence.

Respond with ONLY valid minified JSON, no markdown, in exactly this shape:
{"meals":[{"date":"YYYY-MM-DD","title":"string","description":"string","tags":["healthy","quick"],"recipe_match":"Exact recipe name or null"}]}
Return one object in "meals" for every date in the request, in date order.`;

export type GeneratedMeal = {
  date: string;
  title: string;
  description: string;
  tags: string[];
  recipe_match: string | null;
};

export type MealPlanGeneratePayload = {
  dates: string[];
  dietary_requirements: string[];
  priorities: string[];
  disliked_ingredients: string[];
  household_size: number;
  recipe_library: Array<{ name: string; tags: string[]; meal_type: string }>;
  existing_meals: Array<{ date: string; title: string }>;
  notes: string;
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

export async function generateMealPlan(
  payload: MealPlanGeneratePayload,
): Promise<GeneratedMeal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = resolveAnthropicModel();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2_048,
      system: MEAL_PLAN_SYSTEM_PROMPT,
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
    throw new Error('Empty response from meal planner');
  }

  let parsed: { meals?: unknown };
  try {
    parsed = JSON.parse(extractJson(text)) as { meals?: unknown };
  } catch {
    throw new Error('Could not parse meal plan response');
  }

  const allowedDates = new Set(payload.dates);
  const meals = Array.isArray(parsed.meals) ? parsed.meals : [];

  return meals
    .map((meal): GeneratedMeal | null => {
      if (!meal || typeof meal !== 'object') return null;
      const m = meal as Record<string, unknown>;
      const date = typeof m.date === 'string' ? m.date : '';
      const title = typeof m.title === 'string' ? m.title.trim() : '';
      if (!allowedDates.has(date) || !title) return null;
      return {
        date,
        title,
        description:
          typeof m.description === 'string' ? m.description.trim() : '',
        tags: Array.isArray(m.tags)
          ? m.tags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 8)
          : [],
        recipe_match:
          typeof m.recipe_match === 'string' && m.recipe_match.trim()
            ? m.recipe_match.trim()
            : null,
      };
    })
    .filter((meal): meal is GeneratedMeal => meal !== null);
}
