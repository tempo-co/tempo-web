import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import {useMemo} from 'react';

import {api} from '@/utils/api';

import type {BankCashFlowGranularity, BankCashFlowResponse} from '../types/bank-cash-flow';
import {bankQueryKeys} from './query-keys';

export const useGetBankCashFlow = (granularity: BankCashFlowGranularity) => {
  const range = useMemo(() => getCashFlowRange(granularity), [granularity]);
  const {data, isPending, isFetching, isError, refetch} = useQuery<BankCashFlowResponse>({
    queryKey: bankQueryKeys.cashFlow(granularity, range.from, range.to),
    queryFn: async () => {
      const params = new URLSearchParams({granularity, from: range.from, to: range.to});
      return await api.get<BankCashFlowResponse>(
        `/bank-transactions/cash-flow?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  return {data, isPending, isFetching, isError, refetch, range};
};

function getCashFlowRange(granularity: BankCashFlowGranularity) {
  const today = new Date();
  if (granularity === 'week') {
    return {
      from: format(startOfWeek(subWeeks(today, 11), {weekStartsOn: 1}), 'yyyy-MM-dd'),
      to: format(endOfWeek(today, {weekStartsOn: 1}), 'yyyy-MM-dd'),
    };
  }
  if (granularity === 'year') {
    return {
      from: format(startOfYear(subYears(today, 2)), 'yyyy-MM-dd'),
      to: format(endOfYear(today), 'yyyy-MM-dd'),
    };
  }
  return {
    from: format(startOfMonth(subMonths(today, 5)), 'yyyy-MM-dd'),
    to: format(endOfMonth(today), 'yyyy-MM-dd'),
  };
}
