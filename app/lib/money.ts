import { Decimal128 } from "mongodb";

export function parseMoney(value: FormDataEntryValue | string | number | null) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  const normalized = raw === "" ? "0" : raw;
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new Error("Enter a valid amount.");
  }

  return Math.round(amount * 100) / 100;
}

export function toDecimal(value: FormDataEntryValue | string | number | null) {
  return Decimal128.fromString(parseMoney(value).toFixed(2));
}

export function decimalToNumber(value: Decimal128 | number | string | undefined) {
  if (value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

export function addMoney(...values: Array<Decimal128 | number | string | undefined>) {
  return values.reduce<number>(
    (total, value) => total + decimalToNumber(value),
    0,
  );
}

export { formatCurrency } from "./currency";

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value / 100);
}
