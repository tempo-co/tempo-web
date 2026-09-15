import {Building2, Loader, Plus} from 'lucide-react';
import {useMemo, useState} from 'react';

import {Button} from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import {Skeleton} from '@/components/ui/skeleton';
import {cn} from '@/utils/cn';

import {useGetSupportedBanks} from '../api/use-get-supported-banks';
import type {BankConnectionAspsp} from '../types/bank-connection';

type BankConnectionPickerProps = {
  onBankSelect: (bank: BankConnectionAspsp) => void | Promise<void>;
  isStarting: boolean;
  className?: string;
};

export function BankConnectionPicker({
  onBankSelect,
  isStarting,
  className,
}: BankConnectionPickerProps) {
  const [open, setOpen] = useState(false);
  const {supportedBanks, isPending, isError, refetch} = useGetSupportedBanks(open);
  const banksByCountry = useMemo(() => groupBanksByCountry(supportedBanks ?? []), [supportedBanks]);

  const selectBank = (bank: BankConnectionAspsp) => {
    setOpen(false);
    void onBankSelect(bank);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          className={cn(
            'max-md:h-auto max-md:min-h-11 max-md:max-w-full max-md:whitespace-normal',
            className,
          )}
          disabled={isStarting}
          data-testid='connect-bank-button'
        >
          {isStarting ? <Loader className='animate-slow-spin' /> : <Plus />}
          {isStarting ? 'Connecting...' : 'Connect a bank'}
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='max-h-[85vh] overflow-hidden sm:max-w-xl'>
        <ResponsiveDialogHeader className='text-start'>
          <ResponsiveDialogTitle>Choose a bank</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Select a bank available for personal account-information access.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className='min-h-0 px-0'>
          {isPending ? (
            <div
              className='space-y-2 rounded-lg border p-2'
              role='status'
              aria-label='Loading supported banks'
            >
              {Array.from({length: 5}, (_, index) => (
                <Skeleton key={index} className='h-11 w-full' />
              ))}
            </div>
          ) : isError ? (
            <div
              className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4'
              role='alert'
            >
              <p className='text-sm text-muted-foreground'>Supported banks are unavailable.</p>
              <Button
                variant='outline'
                onClick={() => void refetch()}
                data-testid='supported-banks-retry'
              >
                Try again
              </Button>
            </div>
          ) : (
            <Command className='min-h-0 rounded-lg border'>
              <CommandInput placeholder='Search banks by name or country' />
              <CommandList className='max-h-[50vh] sm:max-h-[22rem]'>
                <CommandEmpty>No supported banks found.</CommandEmpty>
                {Object.entries(banksByCountry).map(([country, banks]) => (
                  <CommandGroup key={country} heading={formatCountry(country)}>
                    {banks.map((bank) => (
                      <CommandItem
                        key={`${bank.country}:${bank.name}`}
                        value={`${bank.name} ${bank.country}`}
                        disabled={isStarting}
                        onSelect={() => selectBank(bank)}
                      >
                        <Building2 className='text-muted-foreground' />
                        <span className='min-w-0 truncate'>{bank.name}</span>
                        <span className='ml-auto shrink-0 text-xs text-muted-foreground'>
                          {bank.country}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function groupBanksByCountry(banks: BankConnectionAspsp[]) {
  return banks.reduce<Record<string, BankConnectionAspsp[]>>((groups, bank) => {
    groups[bank.country] = [...(groups[bank.country] ?? []), bank];
    return groups;
  }, {});
}

function formatCountry(country: string) {
  try {
    const label = new Intl.DisplayNames(undefined, {type: 'region'}).of(country);
    return label ? `${label} (${country})` : country;
  } catch {
    return country;
  }
}
