type CurrencyValue = number | string | { toString(): string } | undefined;

export function formatCurrency(value: CurrencyValue) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value === undefined ? 0 : Number(value.toString()));
}
