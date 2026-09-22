import {createFileRoute} from '@tanstack/react-router';
import {ListFilter, Loader2, PauseCircle, PlayCircle, RefreshCw} from 'lucide-react';
import {toast} from 'sonner';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {
  useDeactivateBankTransactionRule,
  useGetBankTransactionRules,
  useUpdateBankTransactionRule,
} from '@/features/banking/api/use-bank-transaction-rules';
import {
  BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS,
  BankTransactionRule,
} from '@/features/banking/types/bank-transaction-rule';
import {formatBankTransactionCategory} from '@/features/banking/utils/formatters';
import {handleAuthenticatedRedirect} from '@/utils/handle-redirect';

export const Route = createFileRoute('/settings/rules/')({
  component: SettingsRulesIndex,
  beforeLoad: ({context}) => {
    handleAuthenticatedRedirect(context);
  },
});

function SettingsRulesIndex() {
  const {data: rules, isPending, isError, refetch} = useGetBankTransactionRules();
  const deactivateRule = useDeactivateBankTransactionRule();
  const updateRule = useUpdateBankTransactionRule();

  const handleDeactivate = (rule: BankTransactionRule) => {
    deactivateRule.mutate(rule.id, {
      onSuccess: () => toast.success(`Rule “${rule.name}” disabled.`),
      onError: (error) =>
        toast.error(error.message || 'The rule could not be disabled. Please try again.'),
    });
  };

  const handleActivate = (rule: BankTransactionRule) => {
    updateRule.mutate(
      {id: rule.id, active: true},
      {
        onSuccess: () => toast.success(`Rule “${rule.name}” enabled.`),
        onError: (error) =>
          toast.error(
            error.message || 'The rule could not be enabled. Check for conflicts and try again.',
          ),
      },
    );
  };

  return (
    <div className='w-full'>
      <div className='mb-8 flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Transaction rules</h1>
          <p className='mt-2 max-w-xl text-sm text-muted-foreground'>
            Deterministic rules run before AI suggestions. Manual categories always win, and each
            rule shows the exact imported fields it matches.
          </p>
        </div>
        <ListFilter className='hidden h-8 w-8 text-muted-foreground sm:block' aria-hidden='true' />
      </div>

      {isPending && (
        <div className='space-y-4' role='status' aria-label='Loading transaction rules'>
          <Skeleton className='h-32 w-full rounded-lg bg-card' />
          <Skeleton className='h-32 w-full rounded-lg bg-card' />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className='flex flex-col items-start gap-4 py-8'>
            <p className='text-sm text-destructive'>Transaction rules could not be loaded.</p>
            <Button type='button' variant='outline' onClick={() => void refetch()}>
              <RefreshCw aria-hidden='true' />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && rules?.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <ListFilter className='h-8 w-8 text-muted-foreground' aria-hidden='true' />
            <h2 className='font-medium'>No transaction rules yet</h2>
            <p className='max-w-md text-sm text-muted-foreground'>
              Manually categorize a bank transaction, then use “Create rule” to preview and save a
              deterministic match.
            </p>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && rules && rules.length > 0 && (
        <div className='space-y-4'>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isChangingStatus={
                (deactivateRule.isPending && deactivateRule.variables === rule.id) ||
                (updateRule.isPending && updateRule.variables?.id === rule.id)
              }
              onDeactivate={() => handleDeactivate(rule)}
              onActivate={() => handleActivate(rule)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  isChangingStatus,
  onDeactivate,
  onActivate,
}: {
  rule: BankTransactionRule;
  isChangingStatus: boolean;
  onDeactivate: () => void;
  onActivate: () => void;
}) {
  return (
    <Card
      className={!rule.active ? 'opacity-65' : undefined}
      data-testid='bank-transaction-rule-card'
    >
      <CardHeader className='flex flex-row items-start justify-between gap-4 space-y-0'>
        <div className='min-w-0'>
          <CardTitle className='truncate text-base'>{rule.name}</CardTitle>
          <p className='mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]'>
            {formatBankTransactionCategory(rule.category)} · {rule.currency} {rule.amount} ·{' '}
            {rule.bankAccountName || 'Bank account'}
          </p>
          <p className='mt-1 break-all font-mono text-xs text-muted-foreground'>
            Account ID: {rule.bankAccountId}
          </p>
        </div>
        <Badge variant={rule.active ? 'secondary' : 'outline'}>
          {rule.active ? 'Active' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='border bg-muted/20 p-3 text-sm'>
          <p>
            {rule.direction === 'EXPENSE' ? 'Outgoing' : 'Incoming'} {rule.transactionType} from{' '}
            {rule.bankAccountName || 'bank account'}, exactly {rule.currency} {rule.amount}.
          </p>
          <p className='mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]'>
            {BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS[rule.matchField]} contains “{rule.matchText}”
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={rule.active ? onDeactivate : onActivate}
          disabled={isChangingStatus}
        >
          {isChangingStatus ? (
            <Loader2 className='animate-spin' aria-hidden='true' />
          ) : rule.active ? (
            <PauseCircle aria-hidden='true' />
          ) : (
            <PlayCircle aria-hidden='true' />
          )}
          {rule.active ? 'Disable rule' : 'Enable rule'}
        </Button>
      </CardContent>
    </Card>
  );
}
