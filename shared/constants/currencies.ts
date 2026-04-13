export const CURRENCIES = [
  { code: "DZD", name: "Algerian Dinar", symbol: "DA" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
