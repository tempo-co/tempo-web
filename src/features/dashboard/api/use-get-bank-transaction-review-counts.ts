import {useQuery} from '@tanstack/react-query';

import {api} from '@/utils/api';

import type {BankTransactionReviewCounts} from '../types/bank-transaction-summary';
import {dashboardQueryKeys} from './query-keys';

/** Transactions across all months that still need the owner's attention. */
export const useGetBankTransactionReviewCounts = () => {
  const {data, isPending, isError, refetch} = useQuery<BankTransactionReviewCounts>({
    queryKey: dashboardQueryKeys.reviewCounts,
    queryFn: () => api.get<BankTransactionReviewCounts>('/bank-transactions/review-counts'),
  });

  return {reviewCounts: data, isPending, isError, refetch};
};
