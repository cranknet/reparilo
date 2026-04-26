const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;
const CONDITIONAL_RE = /\{\{if\s+(\w+)\}\}([\s\S]*?)\{\{endif\}\}/g;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function renderTemplate(
  body: string,
  vars: Record<string, string | number>,
  locale = "en"
): string {
  let result = body;

  result = result.replace(
    CONDITIONAL_RE,
    (_match, key: string, content: string) => {
      const value = vars[key];
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === 0
      ) {
        return "";
      }
      return content;
    }
  );

  const processedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === "number") {
      processedVars[key] = formatNumber(value, locale);
    } else if (
      typeof value === "string" &&
      ISO_DATE_RE.test(value) &&
      !Number.isNaN(Date.parse(value))
    ) {
      processedVars[key] = formatDate(value, locale);
    } else {
      processedVars[key] = String(value ?? "");
    }
  }

  result = result.replace(
    TEMPLATE_VAR_RE,
    (_match, key: string) => processedVars[key] ?? ""
  );

  return result;
}
