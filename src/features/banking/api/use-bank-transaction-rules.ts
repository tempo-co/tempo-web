import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {HttpError, api} from '@/utils/api';

import {
  BankTransactionRule,
  BankTransactionRuleDraft,
  BankTransactionRuleMutationResponse,
  BankTransactionRulePreview,
} from '../types/bank-transaction-rule';
import {bankQueryKeys} from './query-keys';

export type CreateBankTransactionRuleInput = BankTransactionRuleDraft & {
  applyToExisting: boolean;
};

export type UpdateBankTransactionRuleInput = {
  id: BankTransactionRule['id'];
  name?: string;
  category?: BankTransactionRule['category'];
  matchField?: BankTransactionRule['matchField'];
  matchText?: string;
  active?: boolean;
};

export function useGetBankTransactionRules() {
  return useQuery<BankTransactionRule[], HttpError>({
    queryKey: bankQueryKeys.rules,
    queryFn: async () => await api.get<BankTransactionRule[]>('/bank-transaction-rules'),
  });
}

export function usePreviewBankTransactionRule() {
  return useMutation<BankTransactionRulePreview, HttpError, BankTransactionRuleDraft>({
    mutationFn: async (draft) =>
      await api.post<BankTransactionRulePreview>(
        '/bank-transaction-rules/preview',
        JSON.stringify(draft),
      ),
  });
}

export function useCreateBankTransactionRule() {
  const queryClient = useQueryClient();
  return useMutation<
    BankTransactionRuleMutationResponse,
    HttpError,
    CreateBankTransactionRuleInput
  >({
    mutationFn: async (input) =>
      await api.post<BankTransactionRuleMutationResponse>(
        '/bank-transaction-rules',
        JSON.stringify(input),
      ),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: bankQueryKeys.rules}),
        queryClient.invalidateQueries({queryKey: bankQueryKeys.transactionsRoot}),
        ...result.appliedToTransactionIds.map((id) =>
          queryClient.invalidateQueries({queryKey: bankQueryKeys.transaction(id)}),
        ),
      ]);
    },
  });
}

export function useUpdateBankTransactionRule() {
  const queryClient = useQueryClient();
  return useMutation<BankTransactionRule, HttpError, UpdateBankTransactionRuleInput>({
    mutationFn: async ({id, ...updates}) =>
      await api.patch<BankTransactionRule>(
        `/bank-transaction-rules/${id}`,
        JSON.stringify(updates),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: bankQueryKeys.rules});
    },
  });
}

export function useDeactivateBankTransactionRule() {
  const queryClient = useQueryClient();
  return useMutation<BankTransactionRule, HttpError, BankTransactionRule['id']>({
    mutationFn: async (id) =>
      await api.delete<BankTransactionRule>(`/bank-transaction-rules/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: bankQueryKeys.rules});
    },
  });
}
