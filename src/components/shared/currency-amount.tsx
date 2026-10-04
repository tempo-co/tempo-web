import {cn} from '@/utils/cn';
import {formatCurrency} from '@/utils/format-currency';

type CurrencyAmountProps = {
  amount: number;
  currency: string;
};

export function CurrencyAmount({amount, currency}: CurrencyAmountProps) {
  const formattedAmount = formatCurrency(amount, currency);

  return (
    <span className={cn('font-mono whitespace-nowrap', amount > 0 && 'text-success')}>
      {formattedAmount}
    </span>
  );
}
