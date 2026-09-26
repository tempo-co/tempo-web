import {useNavigate} from '@tanstack/react-router';
import {format, parseISO} from 'date-fns';
import {useEffect, useMemo, useState} from 'react';
import {Bar, BarChart, CartesianGrid, XAxis, YAxis} from 'recharts';

import {AppBodyLayout} from '@/components/shared/layout/app-body';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Skeleton} from '@/components/ui/skeleton';
import {useGetBankCashFlow} from '@/features/banking/api/use-get-bank-cash-flow';
import {BANK_CASH_FLOW_GRANULARITIES} from '@/features/banking/types/bank-cash-flow';
import type {
  BankCashFlowBucket,
  BankCashFlowGranularity,
} from '@/features/banking/types/bank-cash-flow';
import {cn} from '@/utils/cn';

const chartConfig = {
  incomeValue: {
    label: 'Money in',
    color: 'hsl(var(--success))',
  },
  expensesValue: {
    label: 'Money out',
    color: 'hsl(var(--clay))',
  },
} satisfies ChartConfig;

type CashFlowPoint = BankCashFlowBucket & {
  label: string;
  incomeValue: number;
  expensesValue: number;
};

export function BankCashFlowExplorer() {
  const navigate = useNavigate({from: '/bank-transactions/'});
  const [granularity, setGranularity] = useState<BankCashFlowGranularity>('month');
  const {data, isPending, isFetching, isError, refetch} = useGetBankCashFlow(granularity);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selectedBucketStart, setSelectedBucketStart] = useState('');

  const currencies = data?.series.map((series) => series.currency) ?? [];
  const selectedSeries =
    data?.series.find((series) => series.currency === selectedCurrency) ?? data?.series[0];

  useEffect(() => {
    if (!data) {
      return;
    }

    setSelectedCurrency((current) =>
      current && data.series.some((series) => series.currency === current)
        ? current
        : (data.series[0]?.currency ?? ''),
    );
  }, [data]);

  useEffect(() => {
    const buckets = selectedSeries?.buckets ?? [];
    if (!buckets.some((bucket) => bucket.startDate === selectedBucketStart)) {
      setSelectedBucketStart(
        buckets.find((bucket) => bucket.transactionCount > 0)?.startDate ??
          buckets.at(-1)?.startDate ??
          '',
      );
    }
  }, [selectedBucketStart, selectedSeries]);

  const displayedGranularity = data
    ? (data.granularity.toLowerCase() as BankCashFlowGranularity)
    : granularity;
  const points = useMemo<CashFlowPoint[]>(
    () =>
      (selectedSeries?.buckets ?? []).map((bucket) => ({
        ...bucket,
        label: formatBucketLabel(bucket.startDate, displayedGranularity),
        incomeValue: toChartNumber(bucket.income),
        expensesValue: toChartNumber(bucket.expenses),
      })),
    [displayedGranularity, selectedSeries],
  );
  const selectedBucket =
    selectedSeries?.buckets.find((bucket) => bucket.startDate === selectedBucketStart) ??
    selectedSeries?.buckets.at(-1);
  const rangeLabel = data ? `${formatDate(data.from)} – ${formatDate(data.to)}` : '';
  const hasDataQualityNote = Boolean(
    data?.dataQuality.missingBookingDateCount ||
    selectedSeries?.buckets.some((bucket) => bucket.internalCount || bucket.unknownCount),
  );

  const inspectBucket = (bucket: BankCashFlowBucket) => {
    if (!selectedSeries) {
      return;
    }

    void navigate({
      to: '/bank-transactions',
      search: {
        pageIndex: 0,
        pageSize: 50,
        bookingDate: {
          from: parseISO(bucket.startDate),
          to: parseISO(bucket.endDate),
        },
        currency: selectedSeries.currency,
      },
    });
  };

  const handleChartClick = (state: unknown) => {
    const bucketStart = getActiveBucketStart(state);
    if (bucketStart) {
      setSelectedBucketStart(bucketStart);
    }
  };

  return (
    <AppBodyLayout className='max-w-[96rem]'>
      <div className='space-y-6'>
        <header className='flex flex-col justify-between gap-5 md:flex-row md:items-end'>
          <div>
            <p className='text-sm font-medium text-muted-foreground'>Overview</p>
            <h1 className='mt-1 text-3xl font-semibold tracking-tight'>Cash flow</h1>
            <p className='mt-2 max-w-2xl text-sm text-muted-foreground'>
              See what moved in and out, then inspect the transactions behind each period.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <div
              className='flex rounded-md border bg-muted/30 p-1'
              role='group'
              aria-label='Cash-flow granularity'
            >
              {BANK_CASH_FLOW_GRANULARITIES.map((value) => (
                <button
                  key={value}
                  type='button'
                  aria-pressed={granularity === value}
                  className={cn(
                    'px-3 py-1.5 text-sm capitalize transition-colors',
                    granularity === value
                      ? 'bg-background font-medium text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setGranularity(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            {currencies.length > 1 ? (
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className='w-[7rem]' aria-label='Currency'>
                  <SelectValue placeholder='Currency' />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedSeries ? (
              <span className='border px-3 py-2 font-mono text-sm'>{selectedSeries.currency}</span>
            ) : null}
          </div>
        </header>

        {isFetching && !isPending ? (
          <p className='text-xs text-muted-foreground' role='status'>
            Updating {granularity} view…
          </p>
        ) : null}

        {isPending ? (
          <CashFlowLoadingState />
        ) : isError ? (
          <CashFlowErrorState onRetry={() => void refetch()} />
        ) : !data || !selectedSeries ? (
          <CashFlowEmptyState
            missingBookingDateCount={data?.dataQuality.missingBookingDateCount ?? 0}
          />
        ) : (
          <>
            <Card className='overflow-hidden'>
              <CardHeader className='border-b pb-5'>
                <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-start'>
                  <div>
                    <CardTitle className='text-lg'>Money movement</CardTitle>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      {rangeLabel} · {selectedSeries.currency}
                    </p>
                  </div>
                  <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                    <span className='flex items-center gap-1.5'>
                      <span className='size-2 bg-success' aria-hidden='true' /> Money in
                    </span>
                    <span className='flex items-center gap-1.5'>
                      <span className='size-2 bg-clay' aria-hidden='true' /> Money out
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='p-0'>
                <div className='grid border-b lg:grid-cols-[minmax(0,1fr)_18rem]'>
                  <div className='min-w-0 p-4 sm:p-6'>
                    <ChartContainer
                      data-testid='cash-flow-chart'
                      config={chartConfig}
                      className='h-[19rem] w-full'
                    >
                      <BarChart
                        accessibilityLayer
                        data={points}
                        margin={{top: 12, right: 4, left: 0, bottom: 0}}
                        onClick={handleChartClick}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey='label'
                          tickLine={false}
                          tickMargin={10}
                          minTickGap={18}
                        />
                        <YAxis
                          axisLine={false}
                          tickFormatter={(value) =>
                            formatCompactAmount(Number(value), selectedSeries.currency)
                          }
                          tickLine={false}
                          tickMargin={8}
                          width={64}
                        />
                        <ChartTooltip
                          cursor={{fill: 'hsl(var(--muted) / 0.35)'}}
                          content={
                            <ChartTooltipContent
                              labelFormatter={(value) =>
                                formatBucketLabel(String(value), displayedGranularity)
                              }
                              formatter={(_value, _name, item) => {
                                const point = item.payload as CashFlowPoint | undefined;
                                const rawValue =
                                  point && String(item.dataKey) === 'incomeValue'
                                    ? point.income
                                    : (point?.expenses ?? String(_value));
                                return (
                                  <span className='ml-auto font-mono'>
                                    {formatAmount(rawValue, selectedSeries.currency)}
                                  </span>
                                );
                              }}
                            />
                          }
                        />
                        <Bar
                          dataKey='incomeValue'
                          fill='var(--color-incomeValue)'
                          name='Money in'
                          radius={2}
                          onClick={(entry) => {
                            const bucketStart = getBarBucketStart(entry);
                            if (bucketStart) {
                              setSelectedBucketStart(bucketStart);
                            }
                          }}
                        />
                        <Bar
                          dataKey='expensesValue'
                          fill='var(--color-expensesValue)'
                          name='Money out'
                          radius={2}
                          onClick={(entry) => {
                            const bucketStart = getBarBucketStart(entry);
                            if (bucketStart) {
                              setSelectedBucketStart(bucketStart);
                            }
                          }}
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                  <div className='border-t p-5 lg:border-l lg:border-t-0'>
                    <p className='text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground'>
                      Selected period
                    </p>
                    {selectedBucket ? (
                      <div className='mt-4 space-y-4'>
                        <div>
                          <p className='font-medium'>
                            {formatPeriod(selectedBucket, displayedGranularity)}
                          </p>
                          <p className='mt-1 text-xs text-muted-foreground'>
                            {selectedBucket.transactionCount} transaction
                            {selectedBucket.transactionCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className='space-y-3 text-sm'>
                          <MetricRow
                            label='Money in'
                            value={formatAmount(selectedBucket.income, selectedSeries.currency)}
                            valueClassName='text-success'
                          />
                          <MetricRow
                            label='Money out'
                            value={formatAmount(selectedBucket.expenses, selectedSeries.currency)}
                            valueClassName='text-clay'
                          />
                          <MetricRow
                            label='Net movement'
                            value={formatAmount(selectedBucket.net, selectedSeries.currency)}
                            valueClassName={
                              toChartNumber(selectedBucket.net) >= 0 ? 'text-success' : 'text-clay'
                            }
                          />
                        </div>
                        <Button
                          type='button'
                          variant='outline'
                          className='w-full'
                          onClick={() => inspectBucket(selectedBucket)}
                        >
                          Inspect transactions
                        </Button>
                      </div>
                    ) : (
                      <p className='mt-4 text-sm text-muted-foreground'>
                        Select a period to inspect it.
                      </p>
                    )}
                  </div>
                </div>

                <div className='grid divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
                  <SummaryMetric
                    label='Money in'
                    value={formatAmount(selectedSeries.totals.income, selectedSeries.currency)}
                  />
                  <SummaryMetric
                    label='Money out'
                    value={formatAmount(selectedSeries.totals.expenses, selectedSeries.currency)}
                  />
                  <SummaryMetric
                    label='Net movement'
                    value={formatAmount(selectedSeries.totals.net, selectedSeries.currency)}
                  />
                </div>

                {hasDataQualityNote ? (
                  <div className='px-5 py-3 text-xs text-muted-foreground sm:px-6'>
                    <span className='font-medium text-foreground'>Data quality:</span>{' '}
                    {selectedSeries.buckets.reduce(
                      (total, bucket) => total + bucket.internalCount,
                      0,
                    ) > 0
                      ? 'internal activity is excluded from money in/out. '
                      : ''}
                    {selectedSeries.buckets.reduce(
                      (total, bucket) => total + bucket.unknownCount,
                      0,
                    ) > 0
                      ? 'some transactions have unknown treatment. '
                      : ''}
                    {data.dataQuality.missingBookingDateCount > 0
                      ? `${data.dataQuality.missingBookingDateCount} transaction${data.dataQuality.missingBookingDateCount === 1 ? '' : 's'} have no booking date and are not charted.`
                      : ''}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppBodyLayout>
  );
}

function MetricRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-muted-foreground'>{label}</span>
      <span className={cn('font-mono font-medium', valueClassName)}>{value}</span>
    </div>
  );
}

function SummaryMetric({label, value}: {label: string; value: string}) {
  return (
    <div className='flex items-center justify-between gap-4 p-5 sm:block sm:p-6'>
      <p className='text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground'>
        {label}
      </p>
      <p className='mt-1 font-mono text-lg font-semibold'>{value}</p>
    </div>
  );
}

function CashFlowLoadingState() {
  return (
    <Card aria-label='Loading cash flow'>
      <CardHeader className='border-b'>
        <Skeleton className='h-5 w-36' />
        <Skeleton className='h-4 w-64' />
      </CardHeader>
      <CardContent className='space-y-5 p-6'>
        <Skeleton className='h-[19rem] w-full' />
        <div className='grid gap-3 sm:grid-cols-3'>
          <Skeleton className='h-16' />
          <Skeleton className='h-16' />
          <Skeleton className='h-16' />
        </div>
      </CardContent>
    </Card>
  );
}

function CashFlowErrorState({onRetry}: {onRetry: () => void}) {
  return (
    <Card>
      <CardContent className='flex flex-col items-start gap-4 p-6'>
        <div>
          <h2 className='font-medium'>Cash flow could not be loaded</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Try again, or open bank transactions to inspect the source data.
          </p>
        </div>
        <Button type='button' variant='outline' onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function CashFlowEmptyState({missingBookingDateCount}: {missingBookingDateCount: number}) {
  const missingDateMessage =
    missingBookingDateCount > 0
      ? `${missingBookingDateCount} transaction${missingBookingDateCount === 1 ? '' : 's'} have no booking date and are not charted.`
      : 'Once a bank connection has transactions with booking dates, this view will show money in, money out, and the periods behind them.';

  return (
    <Card>
      <CardContent className='p-6'>
        <h2 className='font-medium'>No dated transactions yet</h2>
        <p className='mt-1 max-w-xl text-sm text-muted-foreground'>{missingDateMessage}</p>
      </CardContent>
    </Card>
  );
}

function getActiveBucketStart(state: unknown) {
  const activePayload = getProperty(state, 'activePayload');
  if (!isUnknownArray(activePayload)) {
    return undefined;
  }

  return getStartDate(getProperty(activePayload[0], 'payload'));
}

function getBarBucketStart(entry: unknown) {
  return getStartDate(getProperty(entry, 'payload'));
}

function getStartDate(value: unknown) {
  const startDate = getProperty(value, 'startDate');
  return typeof startDate === 'string' ? startDate : undefined;
}

function getProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return undefined;
  }

  return value[key as keyof typeof value];
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function formatAmount(value: string, currency: string) {
  const parsed = parseDisplayAmount(value);
  if (!parsed) {
    return `${value} ${currency}`;
  }

  try {
    const currencyFormatter = new Intl.NumberFormat(undefined, {
      currency,
      currencyDisplay: 'symbol',
      style: 'currency',
    });
    const minimumFractionDigits = currencyFormatter.resolvedOptions().minimumFractionDigits ?? 0;
    const fraction = parsed.fraction.padEnd(minimumFractionDigits, '0');
    const groupedInteger = formatDisplayInteger(parsed.integer);
    const parts = currencyFormatter.formatToParts(parsed.negative ? -1 : 1);
    const decimalSeparator =
      new Intl.NumberFormat(undefined, {maximumFractionDigits: 1, minimumFractionDigits: 1})
        .formatToParts(1.1)
        .find((part) => part.type === 'decimal')?.value ?? '.';
    const hasFractionPart = parts.some((part) => part.type === 'fraction');

    return parts
      .map((part) => {
        if (part.type === 'integer') {
          return hasFractionPart || !fraction
            ? groupedInteger
            : `${groupedInteger}${decimalSeparator}${fraction}`;
        }
        if (part.type === 'decimal') {
          return fraction ? part.value : '';
        }
        if (part.type === 'fraction') {
          return fraction;
        }
        return part.value;
      })
      .join('');
  } catch {
    return `${parsed.negative ? '-' : ''}${parsed.integer}${parsed.fraction ? `.${parsed.fraction}` : ''} ${currency}`;
  }
}

type ParsedDisplayAmount = {
  negative: boolean;
  integer: string;
  fraction: string;
};

function parseDisplayAmount(value: string): ParsedDisplayAmount | undefined {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const integer = match[2].replace(/^0+(?=\d)/, '');
  const fraction = match[3] ?? '';
  const isZero = integer === '0' && /^0*$/.test(fraction);

  return {
    negative: match[1] === '-' && !isZero,
    integer,
    fraction,
  };
}

function formatDisplayInteger(value: string) {
  const parts = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).formatToParts(123456789012345);
  const groupSeparator = parts.find((part) => part.type === 'group')?.value;
  const integerPartLengths = parts
    .filter((part) => part.type === 'integer')
    .map((part) => part.value.length);

  if (!groupSeparator || integerPartLengths.length < 2) {
    return value;
  }

  const primaryGroupSize = integerPartLengths.at(-1) ?? 3;
  const secondaryGroupSize = integerPartLengths.at(-2) ?? primaryGroupSize;
  const groups: string[] = [];
  let end = value.length;
  let groupSize = primaryGroupSize;

  while (end > groupSize) {
    groups.unshift(value.slice(end - groupSize, end));
    end -= groupSize;
    groupSize = secondaryGroupSize;
  }
  groups.unshift(value.slice(0, end));

  return groups.join(groupSeparator);
}

function formatCompactAmount(value: number, currency: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return currency;
  }
  return new Intl.NumberFormat(undefined, {
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
    notation: 'compact',
    style: 'currency',
  }).format(numericValue);
}

function formatDate(value: string) {
  return format(parseISO(value), 'MMM d, yyyy');
}

function formatBucketLabel(value: string, granularity: BankCashFlowGranularity) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = parseISO(value);
  if (granularity === 'year') {
    return format(date, 'yyyy');
  }
  if (granularity === 'month') {
    return format(date, 'MMM');
  }
  return format(date, 'MMM d');
}

function formatPeriod(bucket: BankCashFlowBucket, granularity: BankCashFlowGranularity) {
  const start = parseISO(bucket.startDate);
  const end = parseISO(bucket.endDate);
  if (granularity === 'year') {
    return format(start, 'yyyy');
  }
  if (granularity === 'month') {
    return format(start, 'MMM yyyy');
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

function toChartNumber(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
