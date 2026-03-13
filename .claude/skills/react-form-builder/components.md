# Makerkit Form Components Reference

## Import Pattern

```typescript
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { Checkbox } from '@kit/ui/checkbox';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';
import { toast } from '@kit/ui/sonner';
```

## Form Field Pattern

```tsx
<FormField
  name="fieldName"
  control={form.control}
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        <Trans i18nKey="namespace:fieldLabel" />
      </FormLabel>
      <FormControl>
        <Input
          data-test="field-name-input"
          placeholder="Enter value"
          {...field}
        />
      </FormControl>
      <FormDescription>
        <Trans i18nKey="namespace:fieldDescription" />
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Select Field

```tsx
<FormField
  name="category"
  control={form.control}
  render={({ field }) => (
    <FormItem>
      <FormLabel>Category</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger data-test="category-select">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Checkbox Field

```tsx
<FormField
  name="acceptTerms"
  control={form.control}
  render={({ field }) => (
    <FormItem className="flex items-center space-x-2">
      <FormControl>
        <Checkbox
          data-test="accept-terms-checkbox"
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <FormLabel className="!mt-0">
        <Trans i18nKey="namespace:acceptTerms" />
      </FormLabel>
    </FormItem>
  )}
/>
```

## Switch Field

```tsx
<FormField
  name="notifications"
  control={form.control}
  render={({ field }) => (
    <FormItem className="flex items-center justify-between">
      <div>
        <FormLabel>Enable Notifications</FormLabel>
        <FormDescription>Receive email notifications</FormDescription>
      </div>
      <FormControl>
        <Switch
          data-test="notifications-switch"
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

## Textarea Field

```tsx
<FormField
  name="description"
  control={form.control}
  render={({ field }) => (
    <FormItem>
      <FormLabel>Description</FormLabel>
      <FormControl>
        <Textarea
          data-test="description-textarea"
          placeholder="Enter description..."
          rows={4}
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Error Alert

```tsx
<If condition={error}>
  <Alert variant="destructive">
    <AlertDescription>
      <Trans i18nKey="common:errors.generic" />
    </AlertDescription>
  </Alert>
</If>
```

## Submit Button

```tsx
<Button
  type="submit"
  disabled={pending}
  data-test="submit-button"
>
  {pending ? (
    <Trans i18nKey="common:submitting" />
  ) : (
    <Trans i18nKey="common:submit" />
  )}
</Button>
```

## Complete Form Template

```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTransition, useState } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import type { z } from 'zod';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Button } from '@kit/ui/button';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { MySchema } from '../_lib/schemas/my.schema';
import { myAction } from '../_lib/server/server-actions';

export function MyForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const form = useForm({
    resolver: zodResolver(MySchema),
    defaultValues: { name: '' },
    mode: 'onChange',
  });

  const onSubmit = (data: z.infer<typeof MySchema>) => {
    setError(false);

    startTransition(async () => {
      try {
        await myAction(data);
        toast.success('Success!');
      } catch (e) {
        if (!isRedirectError(e)) {
          setError(true);
        }
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Form {...form}>
        <If condition={error}>
          <Alert variant="destructive">
            <AlertDescription>
              <Trans i18nKey="common:errors.generic" />
            </AlertDescription>
          </Alert>
        </If>

        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input data-test="name-input" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending} data-test="submit-button">
          {pending ? 'Saving...' : 'Save'}
        </Button>
      </Form>
    </form>
  );
}
```
