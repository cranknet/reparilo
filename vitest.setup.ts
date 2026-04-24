import "@testing-library/jest-dom/vitest";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-at-least-thirty-two-chars-long";
process.env.AI_ENCRYPTION_KEY ??= "test-aes-key-at-least-thirty-two-chars-ok";
