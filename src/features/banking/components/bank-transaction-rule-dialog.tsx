import {ListFilterPlus, Loader2, XCircle} from 'lucide-react';
import {useMemo, useState} from 'react';
import {toast} from 'sonner';

import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';

import {
  useCreateBankTransactionRule,
  usePreviewBankTransactionRule,
} from '../api/use-bank-transaction-rules';
import {BANK_TRANSACTION_CATEGORY_LABELS, BankTransaction} from '../types/bank-transaction';
import {
  BANK_TRANSACTION_RULE_MATCH_FIELDS,
  BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS,
  BankTransactionRuleDraft,
} from '../types/bank-transaction-rule';
import {isBankTransactionCategory} from '../utils/formatters';

export function BankTransactionRuleDialog({transaction}: {transaction: BankTransaction}) {
  const category =
    transaction.category && isBankTransactionCategory(transaction.category)
      ? transaction.category
      : null;
  const defaultMatchField = transaction.providerTransactionDescription
    ? 'BANK_TRANSACTION_DESCRIPTION'
    : 'REMITTANCE_INFORMATION';
  const defaultMatchText =
    transaction.providerTransactionDescription ?? transaction.remittanceInformation ?? '';
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(
    category ? `${BANK_TRANSACTION_CATEGORY_LABELS[category]} transfer` : 'Transaction rule',
  );
  const [matchField, setMatchField] =
    useState<BankTransactionRuleDraft['matchField']>(defaultMatchField);
  const [matchText, setMatchText] = useState(defaultMatchText);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [previewKey, setPreviewKey] = useState('');
  const [preview, setPreview] =
    useState<Awaited<ReturnType<typeof usePreviewBankTransactionRule>>['data']>();
  const previewMutation = usePreviewBankTransactionRule();
  const createMutation = useCreateBankTransactionRule();

  const draft = useMemo<BankTransactionRuleDraft | null>(() => {
    if (!category) return null;
    return {
      sourceTransactionId: transaction.id,
      name: name.trim(),
      category,
      matchField,
      matchText: matchText.trim(),
    };
  }, [category, matchField, matchText, name, transaction.id]);
  const currentDraftKey = JSON.stringify(draft);
  const hasPreviewForCurrentDraft = Boolean(preview && previewKey === currentDraftKey);
  const canPreview = Boolean(draft?.name && draft.matchText) && !previewMutation.isPending;
  const canSave = Boolean(
    draft &&
    hasPreviewForCurrentDraft &&
    preview?.conflictingRuleNames.length === 0 &&
    !createMutation.isPending,
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPreview(undefined);
      setPreviewKey('');
    }
  };

  const handlePreview = () => {
    if (!draft || !canPreview) return;
    previewMutation.mutate(draft, {
      onSuccess: (result) => {
        setPreview(result);
        setPreviewKey(currentDraftKey);
      },
    });
  };

  const handleCreate = () => {
    if (!draft || !canSave) return;
    createMutation.mutate(
      {...draft, applyToExisting},
      {
        onSuccess: (result) => {
          const appliedCount = result.appliedToTransactionIds.length;
          toast.success(
            appliedCount > 0
              ? `Rule saved and applied to ${appliedCount} existing transaction${appliedCount === 1 ? '' : 's'}.`
              : 'Rule saved for future matching transactions.',
          );
          handleOpenChange(false);
        },
      },
    );
  };

  if (!category) return null;

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='mt-3 min-h-10'
        data-testid='create-bank-transaction-rule'
        onClick={() => setOpen(true)}
      >
        <ListFilterPlus aria-hidden='true' />
        Create rule
      </Button>
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-2xl'>
          <ResponsiveDialogHeader className='text-left'>
            <ResponsiveDialogTitle>Create a transaction rule</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Match stable imported fields and apply this category before AI suggestions. Manual
              categories are always preserved.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className='space-y-5 py-2'>
            <div className='space-y-2'>
              <Label htmlFor={`rule-name-${transaction.id}`}>Rule name</Label>
              <Input
                id={`rule-name-${transaction.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder='Roommate rent share'
                maxLength={120}
              />
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor={`rule-field-${transaction.id}`}>Raw field to search</Label>
                <select
                  id={`rule-field-${transaction.id}`}
                  value={matchField}
                  onChange={(event) =>
                    setMatchField(event.target.value as BankTransactionRuleDraft['matchField'])
                  }
                  className='flex min-h-11 w-full border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                >
                  {BANK_TRANSACTION_RULE_MATCH_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS[field]}
                    </option>
                  ))}
                </select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor={`rule-category-${transaction.id}`}>Category</Label>
                <div
                  id={`rule-category-${transaction.id}`}
                  className='flex min-h-11 items-center border bg-muted/30 px-3 text-sm'
                >
                  {BANK_TRANSACTION_CATEGORY_LABELS[category]}
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor={`rule-text-${transaction.id}`}>Text must contain</Label>
              <Input
                id={`rule-text-${transaction.id}`}
                value={matchText}
                onChange={(event) => setMatchText(event.target.value)}
                placeholder='A stable recipient or remittance phrase'
                maxLength={160}
              />
              <p className='text-xs text-muted-foreground'>
                Matching is case-insensitive and uses the imported raw text, not private notes.
              </p>
            </div>

            <label className='flex cursor-pointer items-start gap-3 border bg-muted/20 p-3 text-sm'>
              <input
                type='checkbox'
                checked={applyToExisting}
                onChange={(event) => setApplyToExisting(event.target.checked)}
                className='mt-1 h-4 w-4 accent-primary'
              />
              <span>
                <span className='block font-medium'>Apply to existing non-manual matches</span>
                <span className='mt-1 block text-xs text-muted-foreground'>
                  Existing manual categories will not be changed. Without this option, the rule is
                  future-only.
                </span>
              </span>
            </label>

            <div className='border-t pt-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h3 className='text-sm font-semibold'>Preview</h3>
                  <p className='text-xs text-muted-foreground'>
                    Check the exact match before saving.
                  </p>
                </div>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={handlePreview}
                  disabled={!canPreview}
                >
                  {previewMutation.isPending && (
                    <Loader2 className='animate-spin' aria-hidden='true' />
                  )}
                  Preview matches
                </Button>
              </div>

              {previewMutation.isError && (
                <p role='alert' className='mt-3 text-sm text-destructive'>
                  {previewMutation.error.message || 'The preview could not be loaded.'}
                </p>
              )}
              {preview && hasPreviewForCurrentDraft && (
                <div className='mt-4 space-y-3' data-testid='bank-transaction-rule-preview'>
                  <p className='text-sm'>
                    This rule matches <strong>{preview.totalMatches}</strong> existing transaction
                    {preview.totalMatches === 1 ? '' : 's'}. {preview.existingEligibleMatches} are
                    eligible to update; {preview.existingManualMatches} manual categorization
                    {preview.existingManualMatches === 1 ? '' : 's'} will remain unchanged.
                  </p>
                  {preview.conflictingRuleNames.length > 0 && (
                    <div
                      role='alert'
                      className='flex gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
                    >
                      <XCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                      <span>
                        Conflicts with: {preview.conflictingRuleNames.join(', ')}. Change the
                        condition before saving.
                      </span>
                    </div>
                  )}
                  <div className='text-xs text-muted-foreground'>
                    {preview.direction === 'EXPENSE' ? 'Outgoing' : 'Incoming'}{' '}
                    {preview.transactionType} · exactly {preview.amount} {preview.currency} ·{' '}
                    {BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS[preview.matchField]} contains “
                    {preview.matchText}”
                  </div>
                  {preview.matches.length > 0 && (
                    <ul className='divide-y border' aria-label='Matching transactions'>
                      {preview.matches.map((match) => (
                        <li
                          key={match.id}
                          className='flex items-center justify-between gap-3 px-3 py-2 text-sm'
                        >
                          <span className='min-w-0 truncate'>{match.displayDescription}</span>
                          <span className='shrink-0 font-mono text-xs text-muted-foreground'>
                            {match.amount} {match.currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {createMutation.isError && (
            <p role='alert' className='text-sm text-destructive'>
              {createMutation.error.message || 'The rule could not be saved.'}
            </p>
          )}
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type='button' variant='ghost'>
                Cancel
              </Button>
            </ResponsiveDialogClose>
            <Button type='button' onClick={handleCreate} disabled={!canSave}>
              {createMutation.isPending && <Loader2 className='animate-spin' aria-hidden='true' />}
              Save rule
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
