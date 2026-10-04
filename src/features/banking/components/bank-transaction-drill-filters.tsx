import {useNavigate} from '@tanstack/react-router';
import {X} from 'lucide-react';

import {Button} from '@/components/ui/button';

import {
  BankTransactionBaseAmountFilterValue,
  BankTransactionCashFlowFilterValue,
  BankTransactionCategoryStatusFilterValue,
  BankTransactionFilterParams,
} from '../types/bank-transaction';

const CASH_FLOW_LABELS: Record<BankTransactionCashFlowFilterValue, string> = {
  SPENDING: 'Spending',
  INCOME: 'Income',
  INTERNAL: 'Internal',
  UNKNOWN: 'Unknown direction',
};

const BASE_AMOUNT_LABELS: Record<BankTransactionBaseAmountFilterValue, string> = {
  PRESENT: 'Converted amount',
  MISSING: 'No converted amount yet',
};

const CATEGORY_STATUS_LABELS: Record<BankTransactionCategoryStatusFilterValue, string> = {
  FAILED: 'Not categorized',
  CATEGORIZING: 'Categorizing',
};

type DrillFilterKey = 'cashFlows' | 'baseAmount' | 'categoryStatuses';

function describeDrillFilters(filters: BankTransactionFilterParams) {
  const chips: {key: DrillFilterKey; label: string}[] = [];
  if (filters.cashFlows?.length) {
    chips.push({
      key: 'cashFlows',
      label: filters.cashFlows.map((value) => CASH_FLOW_LABELS[value]).join(' or '),
    });
  }
  if (filters.categoryStatuses?.length) {
    chips.push({
      key: 'categoryStatuses',
      label: filters.categoryStatuses.map((value) => CATEGORY_STATUS_LABELS[value]).join(' or '),
    });
  }
  if (filters.baseAmount) {
    chips.push({key: 'baseAmount', label: BASE_AMOUNT_LABELS[filters.baseAmount]});
  }
  return chips;
}

type BankTransactionDrillFiltersProps = {
  filters: BankTransactionFilterParams;
};

/**
 * The filters a Home dashboard link applied, shown so the list explains itself and each can be
 * removed. They have no picker of their own.
 */
export function BankTransactionDrillFilters({filters}: BankTransactionDrillFiltersProps) {
  const navigate = useNavigate({from: '/bank-transactions/'});
  const chips = describeDrillFilters(filters);
  if (chips.length === 0) return null;

  const removeFilter = (key: DrillFilterKey) =>
    void navigate({search: (prev) => ({...prev, [key]: undefined, pageIndex: 0})});

  return (
    <ul
      aria-label='Filters from Home'
      className='flex flex-wrap items-center gap-2'
      data-testid='bank-transaction-drill-filters'
    >
      {chips.map(({key, label}) => (
        <li key={key}>
          <Button
            variant='secondary'
            size='sm'
            className='h-12 gap-1.5 sm:h-8'
            aria-label={`Remove filter: ${label}`}
            onClick={() => removeFilter(key)}
          >
            {label}
            <X aria-hidden='true' />
          </Button>
        </li>
      ))}
    </ul>
  );
}
