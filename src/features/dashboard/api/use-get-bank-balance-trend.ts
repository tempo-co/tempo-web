import {useQuery} from '@tanstack/react-query';

import {dashboardQueryKeys} from '@/features/banking/api/aggregate-query-keys';
import {api} from '@/utils/api';

import type {BankBalanceTrend} from '../types/bank-balance-trend';
import type {CashFlowInterval} from '../types/bank-transaction-cash-flow';
import {HOME_REFRESH_INTERVAL_MS} from './refresh-interval';

/** Combined balance at the end of each week, month or year between two local dates, as of today. */
export const useGetBankBalanceTrend = (
  interval: CashFlowInterval,
  from: string,
  to: string,
  asOf: string,
) => {
  const {data, isPending, isError, refetch} = useQuery<BankBalanceTrend>({
    queryKey: dashboardQueryKeys.balanceTrend(interval, from, to, asOf),
    queryFn: () => {
      const params = new URLSearchParams({interval, from, to, asOf});
      return api.get<BankBalanceTrend>(`/bank-transactions/balance-trend?${params.toString()}`);
    },
    placeholderData: (previous) => (previous?.interval === interval ? previous : undefined),
    refetchInterval: HOME_REFRESH_INTERVAL_MS,
    staleTime: HOME_REFRESH_INTERVAL_MS,
    refetchOnReconnect: 'always',
  });

  return {balanceTrend: data, isPending, isError, refetch};
};
