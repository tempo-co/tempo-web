import {useQuery} from '@tanstack/react-query';

import {dashboardQueryKeys} from '@/features/banking/api/aggregate-query-keys';
import {api} from '@/utils/api';

import type {BankTransactionCashFlow} from '../types/bank-transaction-cash-flow';
import {HOME_REFRESH_INTERVAL_MS} from './refresh-interval';

/** Monthly spending and income from `from` to `to` (YYYY-MM), cut at the local date `asOf`. */
export const useGetBankTransactionCashFlow = (from: string, to: string, asOf: string) => {
  const {data, isPending, isError, refetch} = useQuery<BankTransactionCashFlow>({
    queryKey: dashboardQueryKeys.cashFlow(from, to, asOf),
    queryFn: () => {
      const params = new URLSearchParams({from, to, asOf});
      return api.get<BankTransactionCashFlow>(`/bank-transactions/cash-flow?${params.toString()}`);
    },
    refetchInterval: HOME_REFRESH_INTERVAL_MS,
    staleTime: HOME_REFRESH_INTERVAL_MS,
    refetchOnReconnect: 'always',
  });

  return {cashFlow: data, isPending, isError, refetch};
};
