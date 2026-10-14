import {
  BANK_TRANSACTION_CATEGORY_LABELS,
  type BankTransactionCategoryFilterValue,
} from '@/features/banking/types/bank-transaction';

import type {BankTransactionSummaryCategory} from '../types/bank-transaction-summary';
import {toCents} from './money';

/** Bills that land whatever the month looks like; everything else is everyday spending. */
export const FIXED_COST_CATEGORIES = [
  'HOUSING_AND_UTILITIES',
  'INSURANCE',
  'SUBSCRIPTIONS',
] as const satisfies readonly BankTransactionCategoryFilterValue[];

export const isFixedCost = (category: BankTransactionCategoryFilterValue) =>
  (FIXED_COST_CATEGORIES as readonly string[]).includes(category);

/** Fixed-cost spending and its usual amount for the same period, in cents. */
export function fixedCosts(categories: BankTransactionSummaryCategory[]) {
  const rows = categories.filter((row) => isFixedCost(row.category));
  return {
    rows,
    spent: rows.reduce((sum, row) => sum + toCents(row.spending), 0),
    usual: rows.reduce((sum, row) => sum + toCents(row.baselineAverage ?? '0.00'), 0),
  };
}

/** "Housing and utilities, insurance": the fixed-cost categories present, in reading order. */
export function fixedCostLabel(rows: BankTransactionSummaryCategory[]) {
  const label = rows
    .map(
      (row) =>
        BANK_TRANSACTION_CATEGORY_LABELS[row.category as (typeof FIXED_COST_CATEGORIES)[number]],
    )
    .join(', ')
    .toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}
