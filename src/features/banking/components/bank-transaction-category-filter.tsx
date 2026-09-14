import {useNavigate} from '@tanstack/react-router';
import {Check, ChevronDown, Tags} from 'lucide-react';
import * as React from 'react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {ScrollArea} from '@/components/ui/scroll-area';
import {Separator} from '@/components/ui/separator';
import {cn} from '@/utils/cn';

import {
  BANK_TRANSACTION_CATEGORIES,
  BANK_TRANSACTION_CATEGORY_LABELS,
  BankTransactionCategory,
  BankTransactionFilterParams,
} from '../types/bank-transaction';
import {BankTransactionCategoryIcon} from './bank-transaction-category-icon';

type BankTransactionCategoryFilterProps = {
  filters: BankTransactionFilterParams;
  setFilters: React.Dispatch<React.SetStateAction<BankTransactionFilterParams>>;
  className?: string;
};

export function BankTransactionCategoryFilter({
  filters,
  setFilters,
  className,
}: BankTransactionCategoryFilterProps) {
  const navigate = useNavigate({from: '/bank-transactions/'});
  const selectedValues = filters.categories || [];
  const selectedCategories = BANK_TRANSACTION_CATEGORIES.filter((category) =>
    selectedValues.includes(category),
  );

  const handleSelect = async (category: BankTransactionCategory) => {
    const newSelectedValues = selectedValues.includes(category)
      ? selectedValues.filter((selectedCategory) => selectedCategory !== category)
      : [...selectedValues, category];

    await navigate({
      search: (prev) => ({
        ...prev,
        categories: newSelectedValues.length === 0 ? undefined : newSelectedValues,
        pageIndex: 0,
      }),
    });
    setFilters((prev) => ({...prev, categories: newSelectedValues}));
  };

  const handleReset = async () => {
    await navigate({search: (prev) => ({...prev, categories: undefined, pageIndex: 0})});
    setFilters((prev) => ({...prev, categories: []}));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          aria-label='Categories'
          className={cn(
            'h-10 sm:h-8',
            selectedValues.length === 0 ? 'border-dashed' : 'border',
            className,
          )}
        >
          <Tags />
          Categories
          {selectedCategories.length > 0 && (
            <>
              <Separator orientation='vertical' className='mx-2 h-4' />
              <Badge variant='secondary' className='rounded-sm px-1 font-normal lg:hidden'>
                {selectedCategories.length}
              </Badge>
              <div className='hidden space-x-1 lg:flex'>
                {selectedCategories.length > 2 ? (
                  <Badge variant='secondary' className='rounded-sm px-2 font-normal'>
                    {selectedCategories.length} selected
                  </Badge>
                ) : (
                  selectedCategories.map((category) => (
                    <span className='rounded bg-accent px-1.5 py-0.5 text-xs' key={category}>
                      {BANK_TRANSACTION_CATEGORY_LABELS[category]}
                    </span>
                  ))
                )}
              </div>
            </>
          )}
          <ChevronDown className='text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[280px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Search categories...' />
          <ScrollArea className='h-fit max-h-[300px]'>
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup>
                {BANK_TRANSACTION_CATEGORIES.map((category) => {
                  const isSelected = selectedValues.includes(category);
                  return (
                    <CommandItem
                      key={category}
                      value={BANK_TRANSACTION_CATEGORY_LABELS[category]}
                      onSelect={() => handleSelect(category)}
                    >
                      <div
                        className={cn(
                          'mr-1 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible',
                        )}
                      >
                        <Check />
                      </div>
                      <BankTransactionCategoryIcon category={category} className='h-5 w-5' />
                      <span className='truncate'>{BANK_TRANSACTION_CATEGORY_LABELS[category]}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {selectedValues.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={handleReset} className='justify-center text-center'>
                      Reset
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
