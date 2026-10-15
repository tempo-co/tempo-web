import {useQueryClient} from '@tanstack/react-query';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {EmailNotVerifiedError, SessionExpiredError} from '@/utils/api';

import {
  fetchBankTransactionCategoryImpact,
  useUpdateBankTransactionCategory,
} from '../api/use-update-bank-transaction-category';
import {
  BANK_TRANSACTION_CATEGORIES,
  BankTransaction,
  BankTransactionCategory,
  BankTransactionCategoryImpact,
} from '../types/bank-transaction';
import {BANK_TRANSACTION_CATEGORY_META} from '../utils/bank-transaction-category-meta';
import {
  formatBankTransactionCategory,
  formatBankTransactionCategorySource,
  formatBankTransactionCategoryStatus,
  isBankTransactionCategory,
} from '../utils/formatters';
import {BankTransactionCategoryIcon} from './bank-transaction-category-icon';
import {BankTransactionCategoryImpactDialog} from './bank-transaction-category-impact-dialog';

type BankTransactionCategorySelectProps = {
  transaction: BankTransaction;
};

export function BankTransactionCategorySelect({transaction}: BankTransactionCategorySelectProps) {
  const queryClient = useQueryClient();
  const {updateBankTransactionCategory, isPending} = useUpdateBankTransactionCategory();
  const [isChecking, setIsChecking] = useState(false);
  const [draft, setDraft] = useState<{
    category: BankTransactionCategory;
    impact: BankTransactionCategoryImpact;
  } | null>(null);
  const previewVersion = useRef(0);
  // A late preview must not save after the owner closes the inspector. Keep the API read deadline.
  useEffect(
    () => () => {
      previewVersion.current++;
    },
    [],
  );
  const selectId = `transaction-${transaction.id}-category`;
  const statusId = `transaction-${transaction.id}-category-status`;
  const selectedCategory =
    transaction.category && isBankTransactionCategory(transaction.category)
      ? transaction.category
      : '';
  const statusLabel = formatBankTransactionCategoryStatus(transaction.categoryStatus);
  const sourceLabel = formatBankTransactionCategorySource(transaction.categorySource);

  const save = async (category: BankTransactionCategory, applyToTransactionIds: string[]) => {
    try {
      await updateBankTransactionCategory({
        id: transaction.id,
        category,
        applyToTransactionIds,
      }).unwrap();
      setDraft(null);
    } catch {
      // The mutation toast reports the error; keep the preview and selection so the owner can retry.
    }
  };

  const handleValueChange = async (value: string) => {
    if (!isBankTransactionCategory(value)) return;
    const version = ++previewVersion.current;
    setIsChecking(true);
    try {
      const impact = await fetchBankTransactionCategoryImpact(queryClient, transaction.id, value);
      if (version !== previewVersion.current) return;
      if (impact.transactions.length > 0) {
        setDraft({category: value, impact});
      } else {
        await save(value, []);
      }
    } catch (error) {
      // An expired session or unverified email has its own toast and redirect.
      const isAuthError =
        error instanceof SessionExpiredError || error instanceof EmailNotVerifiedError;
      if (version === previewVersion.current && !isAuthError) {
        toast.error(
          'Category changes could not be previewed. Nothing was saved. Please try again.',
        );
      }
    } finally {
      if (version === previewVersion.current) setIsChecking(false);
    }
  };

  return (
    <div className='col-span-2 min-w-0' data-testid='bank-transaction-category-control'>
      <dt className='text-xs font-medium text-muted-foreground'>
        <label htmlFor={selectId}>Transaction category</label>
      </dt>
      <dd className='mt-2'>
        <Select
          value={selectedCategory}
          onValueChange={handleValueChange}
          disabled={isPending || isChecking || draft !== null}
        >
          <SelectTrigger
            id={selectId}
            aria-label='Transaction category'
            aria-describedby={statusId}
            className='max-w-md'
          >
            <SelectValue placeholder={formatBankTransactionCategory(transaction.category)}>
              {selectedCategory && <BankTransactionCategoryOption category={selectedCategory} />}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BANK_TRANSACTION_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                <BankTransactionCategoryOption category={category} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </dd>
      <dd
        id={statusId}
        role='status'
        aria-live='polite'
        data-testid='bank-transaction-category-status'
        className='mt-2 text-xs text-muted-foreground'
      >
        <span>{isChecking ? 'Checking other transactions…' : statusLabel}</span>
        {sourceLabel && (
          <>
            <span aria-hidden='true'> · </span>
            <span>{sourceLabel}</span>
          </>
        )}
      </dd>
      {draft && (
        <BankTransactionCategoryImpactDialog
          category={draft.category}
          impact={draft.impact}
          isPending={isPending}
          onCancel={() => setDraft(null)}
          onConfirm={(ids) => void save(draft.category, ids)}
        />
      )}
    </div>
  );
}

function BankTransactionCategoryOption({category}: {category: BankTransactionCategory}) {
  return (
    <span className='inline-flex min-w-0 items-center gap-2'>
      <BankTransactionCategoryIcon category={category} />
      <span className='truncate'>{BANK_TRANSACTION_CATEGORY_META[category].label}</span>
    </span>
  );
}
