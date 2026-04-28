export const CURRENCIES = [
  { code: "DZD", label: "DZD — Algerian Dinar (DA)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "EUR", label: "EUR — Euro (€)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
