const TEMPLATE_VAR_RE = /\{\{(\w+)\}\}/g;

export function renderTemplate(
  body: string,
  vars: Record<string, string>
): string {
  return body.replace(
    TEMPLATE_VAR_RE,
    (_match, key: string) => vars[key] ?? ""
  );
}
