/** Stored ISO 4217 quote currencies; add further codes here as needed. */
export const quoteCurrencies = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type QuoteCurrency = typeof quoteCurrencies[number];

export function formatQuotePrice(amount: number, currency: QuoteCurrency): string {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${currency} ${new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(amount))}`;
}
