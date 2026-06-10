import 'server-only';

export type CategoryOption = {
  id: string;
  name: string;
  kind: 'income' | 'expense';
};

export type TransactionForSuggest = {
  id: string;
  description: string;
  amountPence: number;
};

export type CategorySuggestion = {
  transactionId: string;
  categoryId: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
};

const SYSTEM_PROMPT = `You categorise UK small-business bank transactions using the provided chart of accounts (often from FreeAgent).

Given a list of categories and uncategorised transactions, return ONLY valid JSON (no markdown):
{
  "suggestions": [
    {
      "transactionId": "<uuid>",
      "categoryId": "<uuid or null>",
      "confidence": "high|medium|low",
      "reason": "optional short reason"
    }
  ]
}

Rules:
- Use categoryId from the provided list only — pick the closest FreeAgent-style category name.
- Match income (positive amounts) to income categories, expenses (negative) to expense categories.
- Prefer specific categories (e.g. "Computer Software", "Subscriptions") over broad ones.
- Use null categoryId when genuinely uncertain.`;

export async function suggestTransactionCategories(input: {
  categories: CategoryOption[];
  transactions: TransactionForSuggest[];
}): Promise<CategorySuggestion[]> {
  if (!input.transactions.length) return [];

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return heuristicCategorySuggestions(input);
    }

    const model =
      process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

    const payload = {
      categories: input.categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
      })),
      transactions: input.transactions.map((t) => ({
        id: t.id,
        description: t.description,
        amountPence: t.amountPence,
        direction: t.amountPence >= 0 ? 'income' : 'expense',
      })),
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      }),
    });

    if (!res.ok) {
      console.warn(
        '[finance-category-suggest] Anthropic request failed:',
        res.status,
        (await res.text()).slice(0, 200),
      );
      return heuristicCategorySuggestions(input);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return heuristicCategorySuggestions(input);

    const parsed = JSON.parse(jsonMatch[0]) as {
      suggestions?: CategorySuggestion[];
    };
    const validIds = new Set(input.categories.map((c) => c.id));
    return (parsed.suggestions ?? [])
      .filter((s) => input.transactions.some((t) => t.id === s.transactionId))
      .map((s) => ({
        transactionId: s.transactionId,
        categoryId:
          s.categoryId && validIds.has(s.categoryId) ? s.categoryId : null,
        confidence: s.confidence ?? 'medium',
        reason: s.reason,
      }));
  } catch (err) {
    console.warn('[finance-category-suggest] Falling back to heuristics:', err);
    return heuristicCategorySuggestions(input);
  }
}

function findCategoryByNames(
  categories: CategoryOption[],
  names: string[],
): CategoryOption | undefined {
  for (const name of names) {
    const exact = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exact) return exact;
  }

  for (const name of names) {
    const partial = categories.find((c) =>
      c.name.toLowerCase().includes(name.toLowerCase()),
    );
    if (partial) return partial;
  }

  return undefined;
}

function heuristicCategorySuggestions(input: {
  categories: CategoryOption[];
  transactions: TransactionForSuggest[];
}): CategorySuggestion[] {
  const byKind = {
    income: input.categories.filter((c) => c.kind === 'income'),
    expense: input.categories.filter((c) => c.kind === 'expense'),
  };

  const rules: Array<{
    pattern: RegExp;
    categoryNames: string[];
    kind: 'income' | 'expense';
  }> = [
    {
      pattern: /stripe|paypal|payment|invoice|client|sales/i,
      categoryNames: ['Sales', 'Other income'],
      kind: 'income',
    },
    {
      pattern: /refund|rebate/i,
      categoryNames: ['Other income', 'Refund'],
      kind: 'income',
    },
    {
      pattern:
        /anthropic|openai|aws|azure|google cloud|github|notion|slack|zoom|adobe|subscription|saas|relume|skool|software/i,
      categoryNames: [
        'Computer Software',
        'Subscriptions',
        'Software & subscriptions',
        'Other Computer Costs',
      ],
      kind: 'expense',
    },
    {
      pattern: /train|uber|taxi|fuel|parking|hotel|flight|travel/i,
      categoryNames: ['Travel', 'Motor Expenses'],
      kind: 'expense',
    },
    {
      pattern: /amazon|office|stationery|post|courier|web hosting/i,
      categoryNames: [
        'Office Costs',
        'Stationery',
        'Web Hosting',
        'Office & admin',
      ],
      kind: 'expense',
    },
  ];

  return input.transactions.map((tx) => {
    const kind = tx.amountPence >= 0 ? 'income' : 'expense';
    const desc = tx.description;
    for (const rule of rules) {
      if (rule.kind !== kind) continue;
      if (!rule.pattern.test(desc)) continue;
      const cat = findCategoryByNames(byKind[kind], rule.categoryNames);
      if (cat) {
        return {
          transactionId: tx.id,
          categoryId: cat.id,
          confidence: 'medium' as const,
          reason: 'Keyword match',
        };
      }
    }

    return {
      transactionId: tx.id,
      categoryId: null,
      confidence: 'low' as const,
      reason: 'No confident match',
    };
  });
}
