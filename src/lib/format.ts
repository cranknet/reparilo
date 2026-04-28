export function formatCurrency(
  value: number,
  currency = "DZD",
  locale = "fr-DZ"
): string {
  if (currency === "DZD" && locale === "fr-DZ") {
    return value.toLocaleString("fr-DZ");
  }
  return value.toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** @deprecated Use formatCurrency instead */
export const formatDzd = formatCurrency;
