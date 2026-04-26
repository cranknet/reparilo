import { describe, expect, it } from "vitest";
import { renderTemplate } from "../services/notification-renderer.js";

describe("renderTemplate", () => {
  it("replaces {{key}} placeholders with values", () => {
    const result = renderTemplate(
      "Hello {{name}}, your job {{jobId}} is ready.",
      {
        name: "Ahmed",
        jobId: "JOB-001",
      }
    );
    expect(result).toBe("Hello Ahmed, your job JOB-001 is ready.");
  });

  it("replaces missing keys with empty string", () => {
    const result = renderTemplate("Hello {{name}}, status: {{status}}", {
      name: "Sara",
    });
    expect(result).toBe("Hello Sara, status: ");
  });

  it("handles template with no placeholders", () => {
    const result = renderTemplate("No variables here.", {});
    expect(result).toBe("No variables here.");
  });

  it("handles repeated placeholders", () => {
    const result = renderTemplate("{{name}} says hi to {{name}}", {
      name: "Karim",
    });
    expect(result).toBe("Karim says hi to Karim");
  });

  it("handles empty template body", () => {
    const result = renderTemplate("", { name: "test" });
    expect(result).toBe("");
  });

  it("ignores placeholders not in vars", () => {
    const result = renderTemplate("Hi {{name}}, {{unknown}}", {
      name: "Lina",
    });
    expect(result).toBe("Hi Lina, ");
  });
});
