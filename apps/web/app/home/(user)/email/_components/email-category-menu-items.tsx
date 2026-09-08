'use client';

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import {
  EMAIL_THREAD_CATEGORIES,
  EMAIL_THREAD_CATEGORY_HINTS,
  EMAIL_THREAD_CATEGORY_LABELS,
  type EmailThreadCategory,
} from '~/lib/email-assistant/email-thread-categories';

import { EMAIL_CATEGORY_STYLES } from '../_lib/email-category-styles';

type Props = {
  currentCategory?: EmailThreadCategory | null;
  disabled?: boolean;
  onSelectCategory: (category: EmailThreadCategory) => void;
  asSubmenu?: boolean;
};

function CategoryMenuItems({
  currentCategory,
  disabled,
  onSelectCategory,
}: Omit<Props, 'asSubmenu'>) {
  return EMAIL_THREAD_CATEGORIES.map((category) => {
    const styles = EMAIL_CATEGORY_STYLES[category];

    return (
      <DropdownMenuItem
        key={category}
        disabled={disabled || currentCategory === category}
        onSelect={() => onSelectCategory(category)}
        className="flex flex-col items-start gap-0.5 py-2"
      >
        <span className="flex items-center">
          <span
            className={cn('mr-2 h-2 w-2 shrink-0 rounded-full', styles.dot)}
            aria-hidden
          />
          {EMAIL_THREAD_CATEGORY_LABELS[category]}
        </span>
        <span className="pl-4 text-xs font-normal text-[var(--workspace-shell-text-muted)]">
          {EMAIL_THREAD_CATEGORY_HINTS[category]}
        </span>
      </DropdownMenuItem>
    );
  });
}

export function EmailCategoryMenuItems({
  currentCategory,
  disabled,
  onSelectCategory,
  asSubmenu = false,
}: Props) {
  const items = (
    <CategoryMenuItems
      currentCategory={currentCategory}
      disabled={disabled}
      onSelectCategory={onSelectCategory}
    />
  );

  if (!asSubmenu) {
    return items;
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={disabled}>
        Category
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-56">
        {items}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
