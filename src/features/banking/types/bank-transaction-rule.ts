import {z} from 'zod';

import {BANK_TRANSACTION_CATEGORIES, type BankTransactionCategory} from './bank-transaction';

export const BANK_TRANSACTION_RULE_MATCH_FIELDS = [
  'BANK_TRANSACTION_DESCRIPTION',
  'REMITTANCE_INFORMATION',
] as const;
export type BankTransactionRuleMatchField = (typeof BANK_TRANSACTION_RULE_MATCH_FIELDS)[number];

export const BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS: Record<
  BankTransactionRuleMatchField,
  string
> = {
  BANK_TRANSACTION_DESCRIPTION: 'Bank description',
  REMITTANCE_INFORMATION: 'Remittance information',
};

export const bankTransactionRuleResponseSchema = z.object({
  id: z.string().uuid(),
  bankAccountId: z.string().uuid(),
  bankAccountName: z.string().nullable(),
  name: z.string(),
  category: z.enum(BANK_TRANSACTION_CATEGORIES),
  active: z.boolean(),
  direction: z.enum(['INCOME', 'EXPENSE']),
  transactionType: z.string(),
  currency: z.string(),
  amount: z.string(),
  matchField: z.enum(BANK_TRANSACTION_RULE_MATCH_FIELDS),
  matchText: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BankTransactionRule = z.infer<typeof bankTransactionRuleResponseSchema>;

export type BankTransactionRuleDraft = {
  sourceTransactionId: string;
  name: string;
  category: BankTransactionCategory;
  matchField: BankTransactionRuleMatchField;
  matchText: string;
};

export type BankTransactionRulePreviewTransaction = {
  id: string;
  bookingDate: string | null;
  amount: string;
  currency: string;
  displayDescription: string;
  category: BankTransactionCategory | null;
  categorySource: 'AI' | 'MANUAL' | 'RULE' | null;
};

export type BankTransactionRulePreview = {
  bankAccountId: string;
  direction: 'INCOME' | 'EXPENSE';
  transactionType: string;
  currency: string;
  amount: string;
  matchField: BankTransactionRuleMatchField;
  matchText: string;
  totalMatches: number;
  existingManualMatches: number;
  existingRuleMatches: number;
  existingEligibleMatches: number;
  conflictingRuleNames: string[];
  matches: BankTransactionRulePreviewTransaction[];
};

export type BankTransactionRuleMutationResponse = {
  rule: BankTransactionRule;
  appliedToTransactionIds: string[];
};
