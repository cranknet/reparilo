import {
  changePasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  signInSchema,
} from "@shared/schemas/auth.schema";
import { describe, expect, it } from "vitest";

describe("Password complexity policy", () => {
  const validPassword = "Test1234";

  const weakPasswords = [
    { pw: "short7A", reason: "too short" },
    { pw: "alllowercase1", reason: "no uppercase" },
    { pw: "ALLUPPERCASE1", reason: "no lowercase" },
    { pw: "NoDigitsHere", reason: "no digit" },
    { pw: "12345678", reason: "no letters" },
  ];

  describe("signInSchema", () => {
    it("accepts any non-empty password", () => {
      const result = signInSchema.safeParse({
        username: "testuser",
        password: "anything",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = signInSchema.safeParse({
        username: "testuser",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createUserSchema", () => {
    it("accepts a strong password", () => {
      const result = createUserSchema.safeParse({
        username: "testuser",
        email: "test@test.com",
        role: "OWNER" as const,
        password: validPassword,
      });
      expect(result.success).toBe(true);
    });

    for (const { pw, reason } of weakPasswords) {
      it(`rejects "${pw}" (${reason})`, () => {
        const result = createUserSchema.safeParse({
          username: "testuser",
          email: "test@test.com",
          role: "OWNER" as const,
          password: pw,
        });
        expect(result.success).toBe(false);
      });
    }
  });

  describe("changePasswordSchema", () => {
    it("accepts any non-empty oldPassword with strong newPassword", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "oldweak",
        newPassword: "NewPass123",
      });
      expect(result.success).toBe(true);
    });

    for (const { pw, reason } of weakPasswords) {
      it(`rejects weak newPassword "${pw}" (${reason})`, () => {
        const result = changePasswordSchema.safeParse({
          oldPassword: "oldweak",
          newPassword: pw,
        });
        expect(result.success).toBe(false);
      });
    }
  });

  describe("resetPasswordSchema", () => {
    it("accepts strong password", () => {
      const result = resetPasswordSchema.safeParse({
        password: validPassword,
      });
      expect(result.success).toBe(true);
    });

    for (const { pw, reason } of weakPasswords) {
      it(`rejects "${pw}" (${reason})`, () => {
        const result = resetPasswordSchema.safeParse({ password: pw });
        expect(result.success).toBe(false);
      });
    }
  });
});
