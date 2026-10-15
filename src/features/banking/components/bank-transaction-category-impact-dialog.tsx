import {useState} from 'react';

import {CurrencyAmount} from '@/components/shared/currency-amount';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {BankTransactionCategory, BankTransactionCategoryImpact} from '../types/bank-transaction';
import {formatBankTransactionCategory, formatBankTransactionDate} from '../utils/formatters';

type BankTransactionCategoryImpactDialogProps = {
  category: BankTransactionCategory;
  impact: BankTransactionCategoryImpact;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (selectedIds: string[]) => void;
};

export function BankTransactionCategoryImpactDialog({
  category,
  impact,
  isPending,
  onCancel,
  onConfirm,
}: BankTransactionCategoryImpactDialogProps) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(impact.transactions.map(({id}) => id)),
  );
  const toggle = (id: string, selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onCancel()}>
      <DialogContent
        data-testid='category-impact-dialog'
        className='flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl [&>button:last-child]:hidden'
      >
        <DialogHeader className='shrink-0 border-b p-5 text-left'>
          <DialogTitle>Update other transactions?</DialogTitle>
          <DialogDescription className='pt-2'>
            This transaction will be set to {formatBankTransactionCategory(category)}. Choose which
            other transactions to {impact.action === 'RECHECK' ? 're-check with AI' : 'update'}.
            Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 overflow-y-auto overscroll-contain p-5'>
          {impact.total > impact.transactions.length && (
            <p role='status' className='mb-4 text-sm text-muted-foreground'>
              Showing the newest {impact.transactions.length} of {impact.total} matches. Only the
              selected transactions below will change.
            </p>
          )}
          <fieldset disabled={isPending}>
            <legend className='sr-only'>Other transactions to change</legend>
            <ul className='divide-y'>
              {impact.transactions.map((transaction) => (
                <li key={transaction.id}>
                  <label className='flex cursor-pointer items-start gap-3 py-3'>
                    <input
                      type='checkbox'
                      className='mt-1 size-5 shrink-0 accent-primary'
                      checked={selectedIds.has(transaction.id)}
                      onChange={(event) => toggle(transaction.id, event.target.checked)}
                    />
                    <span className='min-w-0 flex-1 space-y-1'>
                      <span className='block text-sm font-medium wrap-anywhere'>
                        {transaction.displayDescription}
                      </span>
                      <span className='block text-xs text-muted-foreground'>
                        {formatBankTransactionDate(
                          transaction.transactionDate ?? transaction.bookingDate,
                        )}
                        {' · '}
                        <CurrencyAmount
                          amount={Number(transaction.amount)}
                          currency={transaction.currency}
                        />
                      </span>
                      <span className='block text-sm'>
                        {formatBankTransactionCategory(transaction.category)}
                        {' → '}
                        {impact.action === 'RECHECK'
                          ? 'Will be re-checked by AI'
                          : formatBankTransactionCategory(impact.category)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <p className='mt-3 text-xs text-muted-foreground'>
            Unticked transactions stay as they are. They may be offered again on a later correction.
          </p>
        </div>
        <DialogFooter className='shrink-0 gap-2 border-t p-5'>
          <Button variant='outline' disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant='outline' disabled={isPending} onClick={() => onConfirm([])}>
            Just this one
          </Button>
          <Button
            disabled={isPending || selectedIds.size === 0}
            onClick={() =>
              onConfirm(impact.transactions.filter(({id}) => selectedIds.has(id)).map(({id}) => id))
            }
          >
            {isPending ? 'Saving…' : `Update selected (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
