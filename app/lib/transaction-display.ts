import { formatCurrency } from "@/app/lib/currency";

const incomingTransactionTypes = new Set(["income", "refund"]);

export function getSignedTransactionAmount(type: string, amount: number) {
  return incomingTransactionTypes.has(type) ? Math.abs(amount) : -Math.abs(amount);
}

export function getTransactionAmountDisplay(type: string, amount: number) {
  const signedAmount = getSignedTransactionAmount(type, amount);
  const isIncoming = signedAmount >= 0;

  return {
    className: isIncoming
      ? "text-emerald-600"
      : "text-rose-600",
    label: `${isIncoming ? "+" : "(-)"} ${formatCurrency(Math.abs(signedAmount))}`,
    signedAmount,
  };
}
