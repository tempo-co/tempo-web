import {ArrowLeftRight, ChevronDown} from 'lucide-react';
import * as React from 'react';

import {Button} from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {useBankTransactionArrayFilter} from '@/hooks/use-bank-transaction-array-filter';
import {cn} from '@/utils/cn';

import {
  BANK_TRANSACTION_CASH_FLOW_FILTER_VALUES,
  BANK_TRANSACTION_INTERNAL_MOVEMENT_KINDS,
  BankTransactionCashFlowFilterValue,
  BankTransactionFilterParams,
} from '../types/bank-transaction';
import {CASH_FLOW_LABELS} from '../utils/drill-filters';
import {BankTransactionFilterSection} from './bank-transaction-filter-section';
import {FilterCheckIndicator, SelectedFilterSummary} from './bank-transaction-multi-select-filter';

type BankTransactionCashFlowFilterProps = {
  filters: BankTransactionFilterParams;
  variant?: 'popover' | 'mobile';
  className?: string;
};

function getEventLabel(eventType: BankTransactionCashFlowFilterValue) {
  return CASH_FLOW_LABELS[eventType];
}

const isInternalKind = (value: BankTransactionCashFlowFilterValue) =>
  (BANK_TRANSACTION_INTERNAL_MOVEMENT_KINDS as readonly string[]).includes(value);

export function BankTransactionCashFlowFilter({
  filters,
  variant = 'popover',
  className,
}: BankTransactionCashFlowFilterProps) {
  const {
    selectedValues,
    toggle: handleSelect,
    reset: handleReset,
  } = useBankTransactionArrayFilter(filters, 'cashFlows');
  const selectedLabels = selectedValues.map(getEventLabel);
  const selectionDescriptionId = React.useId();

  const eventCommand = (
    <Command>
      <CommandList>
        <CommandGroup>
          {BANK_TRANSACTION_CASH_FLOW_FILTER_VALUES.map((eventType) => {
            const isSelected = selectedValues.includes(eventType);
            return (
              <CommandItem
                key={eventType}
                value={getEventLabel(eventType)}
                aria-describedby={`${selectionDescriptionId}-${eventType}`}
                data-filter-selected={isSelected}
                onSelect={() => void handleSelect(eventType)}
                // Currency exchanges and own transfers narrow Internal movements, so they sit under it.
                className={cn(isInternalKind(eventType) && 'pl-8')}
              >
                <FilterCheckIndicator isSelected={isSelected} />
                <span className='truncate'>{getEventLabel(eventType)}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {BANK_TRANSACTION_CASH_FLOW_FILTER_VALUES.map((eventType) => (
          <span key={eventType} id={`${selectionDescriptionId}-${eventType}`} className='sr-only'>
            {selectedValues.includes(eventType) ? 'Selected' : 'Not selected'}
          </span>
        ))}
        {selectedValues.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => void handleReset()}
                className='justify-center text-center'
              >
                Reset
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );

  if (variant === 'mobile') {
    return (
      <BankTransactionFilterSection label='Cash flow'>
        <div className='overflow-hidden rounded-md border bg-background'>{eventCommand}</div>
      </BankTransactionFilterSection>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          aria-label={
            selectedLabels.length > 0 ? `Cash flow: ${selectedLabels.join(', ')}` : 'Cash flow'
          }
          className={cn(
            'h-12 sm:h-8',
            selectedValues.length === 0 ? 'border-dashed' : 'border',
            className,
          )}
        >
          <ArrowLeftRight />
          Cash flow
          <SelectedFilterSummary
            items={selectedValues.map((value, index) => ({
              key: value,
              label: selectedLabels[index],
            }))}
          />
          <ChevronDown className='text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[240px] p-0' align='start'>
        {eventCommand}
      </PopoverContent>
    </Popover>
  );
}
