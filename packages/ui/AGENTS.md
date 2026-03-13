# UI Components & Styling

## Skills

For forms:
- `/react-form-builder` - Forms with validation and server actions

## Import Convention

Always use `@kit/ui/{component}`:

```tsx
import { Button } from '@kit/ui/button';
import { Card } from '@kit/ui/card';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
```

## Styling

- Tailwind CSS v4 with semantic classes
- Prefer: `bg-background`, `text-muted-foreground`, `border-border`
- Use `cn()` for class merging
- Never use hardcoded colors like `bg-white`

## Key Components

| Component | Usage |
|-----------|-------|
| `If` | Conditional rendering |
| `Trans` | Internationalization |
| `toast` | Notifications |
| `Form*` | Form fields |
| `Button` | Actions |
| `Card` | Content containers |
| `Alert` | Error/info messages |

## Conditional Rendering

```tsx
import { If } from '@kit/ui/if';

<If condition={isLoading} fallback={<Content />}>
  <Spinner />
</If>
```

## Internationalization

```tsx
import { Trans } from '@kit/ui/trans';

<Trans i18nKey="namespace:key" values={{ name }} />
```

## Testing Attributes

Always add `data-test` for E2E:

```tsx
<button data-test="submit-button">Submit</button>
```

## Form Guidelines

- Use `react-hook-form` with `zodResolver`
- Never add generics to `useForm`
- Use `useWatch` instead of `watch()`
- Always include `FormMessage` for errors
