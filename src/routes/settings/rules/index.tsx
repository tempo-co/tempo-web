import {createFileRoute} from '@tanstack/react-router';
import {ListFilter, Loader2, PauseCircle, RefreshCw} from 'lucide-react';
import {toast} from 'sonner';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {
  useDeactivateBankTransactionRule,
  useGetBankTransactionRules,
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

  const handleDeactivate = (rule: BankTransactionRule) => {
    deactivateRule.mutate(rule.id, {
      onSuccess: () => toast.success(`Rule “${rule.name}” disabled.`),
    });
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
        <div className='space-y-4' aria-label='Loading transaction rules'>
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
              isDeactivating={deactivateRule.isPending && deactivateRule.variables === rule.id}
              onDeactivate={() => handleDeactivate(rule)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  isDeactivating,
  onDeactivate,
}: {
  rule: BankTransactionRule;
  isDeactivating: boolean;
  onDeactivate: () => void;
}) {
  return (
    <Card
      className={!rule.active ? 'opacity-65' : undefined}
      data-testid='bank-transaction-rule-card'
    >
      <CardHeader className='flex flex-row items-start justify-between gap-4 space-y-0'>
        <div className='min-w-0'>
          <CardTitle className='truncate text-base'>{rule.name}</CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            {formatBankTransactionCategory(rule.category)} · {rule.currency} {rule.amount}
          </p>
        </div>
        <Badge variant={rule.active ? 'secondary' : 'outline'}>
          {rule.active ? 'Active' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='border bg-muted/20 p-3 text-sm'>
          <p>
            {rule.direction === 'EXPENSE' ? 'Outgoing' : 'Incoming'} {rule.transactionType} from the
            current account, exactly {rule.currency} {rule.amount}.
          </p>
          <p className='mt-1 text-muted-foreground'>
            {BANK_TRANSACTION_RULE_MATCH_FIELD_LABELS[rule.matchField]} contains “{rule.matchText}”
          </p>
        </div>
        {rule.active && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onDeactivate}
            disabled={isDeactivating}
          >
            {isDeactivating ? (
              <Loader2 className='animate-spin' aria-hidden='true' />
            ) : (
              <PauseCircle aria-hidden='true' />
            )}
            Disable rule
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
