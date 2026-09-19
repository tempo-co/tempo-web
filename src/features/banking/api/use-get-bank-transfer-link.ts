import {useQuery} from '@tanstack/react-query';

import {api} from '@/utils/api';

import {BankTransferLink, BankTransferLinkSchema} from '../types/bank-transfer-link';
import {bankQueryKeys} from './query-keys';

export const useGetBankTransferLink = (transactionId: string, enabled = true) => {
  const {data: transferLink, isPending} = useQuery<BankTransferLink>({
    queryKey: [...bankQueryKeys.transaction(transactionId), 'transfer-link'] as const,
    queryFn: async () => {
      const response = await api.get<unknown>(`/bank-transactions/${transactionId}/transfer-link`);
      return BankTransferLinkSchema.parse(response);
    },
    // an unlinked or non-owned transaction 404s; treat as "no link" rather than an error state
    retry: false,
    enabled: enabled && Boolean(transactionId),
    staleTime: 30_000,
    gcTime: 0,
  });

  return {transferLink: transferLink ?? null, isPending};
};
