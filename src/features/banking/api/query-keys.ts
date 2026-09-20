import type {PaginationParams} from '@/types/pagination';

import type {BankCashFlowGranularity} from '../types/bank-cash-flow';
import type {
  BankTransactionFilterParams,
  BankTransactionSortParams,
} from '../types/bank-transaction';

export const bankQueryKeys = {
  connections: ['bank-connections'] as const,
  connectionTransactions: (connectionId: string, syncVersion: string | null) =>
    ['bank-connection-transactions', connectionId, syncVersion] as const,
  transaction: (id: string) => ['bank-transaction', id] as const,
  transactions: (
    pagination: PaginationParams,
    filters: BankTransactionFilterParams,
    sort: BankTransactionSortParams,
  ) => ['bank-transactions', pagination, filters, sort] as const,
  transactionsRoot: ['bank-transactions'] as const,
  cashFlow: (granularity: BankCashFlowGranularity, from: string, to: string) =>
    ['bank-cash-flow', granularity, from, to] as const,
};
