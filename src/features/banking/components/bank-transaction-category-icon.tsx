import {cn} from '@/utils/cn';

import {BankTransactionCategory} from '../types/bank-transaction';
import {BANK_TRANSACTION_CATEGORY_META} from '../utils/bank-transaction-category-meta';

type BankTransactionCategoryIconProps = {
  category: BankTransactionCategory;
  size?: 'sm' | 'md';
  className?: string;
};

export function BankTransactionCategoryIcon({
  category,
  size = 'sm',
  className,
}: BankTransactionCategoryIconProps) {
  const {icon: Icon, colorClassName} = BANK_TRANSACTION_CATEGORY_META[category];

  return (
    <span
      aria-hidden='true'
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border',
        size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
        colorClassName,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.8} />
    </span>
  );
}
